import "server-only";
import { createPrivateKey } from "node:crypto";
import { prisma } from "@repo/db";
import { decryptIntegrationSecret, encryptIntegrationSecret, requireIntegrationsMasterKey } from "@/lib/integrations/vault";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { clientDisplayName } from "@/lib/clients/display";
import { renglonesDeVenta, type DatosFormulario, type RenglonFactura } from "./borrador";
import { revisarCertificado } from "./certificado";
import {
  ARCA_URLS,
  CBTE_FACTURA_C,
  CBTE_NOTA_CREDITO_C,
  CONDICIONES_EMISOR,
  WSFE_SERVICE,
  esAmbiente,
  type ArcaEnvironment,
  type CbteTipo,
} from "./constants";
import { aliasValido, generarClaveYCsr } from "./csr";
import { conciliar, emitir, type ResultadoConciliacion, type ResultadoEmision } from "./emision";
import { cuitValido, fechaArca, validarComprobante, type DatosComprobante } from "./pedido";
import { depositoTicketPrisma, puertoBasePrisma, type Actor, type EmisorSnapshot } from "./repositorio";
import { crearTransporte } from "./soap";
import { obtenerTicket } from "./ticket";
import { pedirTicket } from "./wsaa";
import { crearClienteWsfe, puertoArca } from "./wsfe";

/**
 * Las operaciones de facturación. Quien llama ya pasó la guarda (`lib/invoicing/access.ts`):
 * acá el workspace llega resuelto desde la sesión, nunca desde un formulario.
 */

export type Ctx = { workspaceId: string; actor: Actor };
export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// --- Perfil fiscal ----------------------------------------------------------------------------

export type PerfilFiscalForm = {
  cuit: string;
  razonSocial: string;
  ivaCondition: string;
  domicilioFiscal: string;
  ingresosBrutos: string;
  inicioActividades: string;
  defaultPointOfSale: string;
  activeEnvironment: string;
};

export async function leerPerfil(workspaceId: string) {
  return prisma.fotofficeFiscalProfile.findUnique({ where: { workspaceId } });
}

export async function guardarPerfil(ctx: Ctx, f: PerfilFiscalForm): Promise<Resultado> {
  const cuit = f.cuit.replace(/\D/g, "");
  if (!cuitValido(cuit)) return { ok: false, error: "El CUIT no es válido. Escribilo con sus 11 números." };
  const razonSocial = f.razonSocial.trim().slice(0, 200);
  if (!razonSocial) return { ok: false, error: "Falta la razón social (tu nombre y apellido si sos monotributista)." };
  if (!(CONDICIONES_EMISOR as readonly string[]).includes(f.ivaCondition)) return { ok: false, error: "Por ahora FOTOFFICE sólo factura a monotributistas y exentos (Factura C)." };
  const domicilioFiscal = f.domicilioFiscal.trim().slice(0, 300);
  if (!domicilioFiscal) return { ok: false, error: "Falta el domicilio fiscal." };
  const inicio = f.inicioActividades.trim();
  if (inicio && !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return { ok: false, error: "La fecha de inicio de actividades no es válida." };
  const pv = f.defaultPointOfSale.trim() ? Number(f.defaultPointOfSale) : null;
  if (pv !== null && (!Number.isInteger(pv) || pv < 1 || pv > 99998)) return { ok: false, error: "El punto de venta es un número entre 1 y 99998." };
  if (!esAmbiente(f.activeEnvironment)) return { ok: false, error: "Elegí el ambiente." };

  const actual = await leerPerfil(ctx.workspaceId);
  if (f.activeEnvironment === "PRODUCCION" && actual?.activeEnvironment !== "PRODUCCION") {
    const cred = await prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId: ctx.workspaceId, environment: "PRODUCCION" } } });
    if (cred?.status !== "ACTIVA") return { ok: false, error: "Para pasar a producción primero hay que subir el certificado de producción." };
    const probada = await prisma.fotofficeInvoice.count({ where: { workspaceId: ctx.workspaceId, environment: "HOMOLOGACION", status: { in: ["AUTORIZADA", "ANULADA"] } } });
    if (probada === 0) return { ok: false, error: "Antes de producción hay que emitir al menos una factura de prueba en homologación (§11.10: homologación completa antes de producción)." };
  }
  if (actual && actual.cuit !== cuit) {
    const emitidas = await prisma.fotofficeInvoice.count({ where: { workspaceId: ctx.workspaceId, status: { in: ["AUTORIZADA", "ANULADA", "PENDIENTE"] } } });
    if (emitidas > 0) return { ok: false, error: "Ya hay comprobantes emitidos con este CUIT: no se puede cambiar." };
  }
  const data = {
    cuit,
    razonSocial,
    ivaCondition: f.ivaCondition,
    domicilioFiscal,
    ingresosBrutos: f.ingresosBrutos.trim().slice(0, 50) || null,
    inicioActividades: inicio || null,
    defaultPointOfSale: pv,
    activeEnvironment: f.activeEnvironment,
    updatedByUserId: ctx.actor.userId,
  };
  await prisma.fotofficeFiscalProfile.upsert({ where: { workspaceId: ctx.workspaceId }, create: { workspaceId: ctx.workspaceId, ...data }, update: data });
  return { ok: true };
}

// --- Credenciales -----------------------------------------------------------------------------

export async function leerCredenciales(workspaceId: string) {
  const filas = await prisma.fotofficeArcaCredential.findMany({
    where: { workspaceId },
    select: { environment: true, alias: true, status: true, certExpiresAt: true, certSerial: true, certUploadedAt: true, createdAt: true },
  });
  return new Map(filas.map((f) => [f.environment, f]));
}

/** Genera la clave privada (queda cifrada en la base) y el pedido de certificado. */
export async function generarPedidoCertificado(ctx: Ctx, environment: ArcaEnvironment, alias: string, reemplazar: boolean): Promise<Resultado> {
  const perfil = await leerPerfil(ctx.workspaceId);
  if (!perfil) return { ok: false, error: "Primero completá los datos fiscales del negocio." };
  if (!aliasValido(alias)) return { ok: false, error: "El nombre del certificado sólo puede tener letras y números, sin espacios." };
  const actual = await prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId: ctx.workspaceId, environment } } });
  if (actual?.status === "ACTIVA" && !reemplazar) {
    return { ok: false, error: "Este ambiente ya tiene un certificado funcionando. Para reemplazarlo marcá la casilla de confirmación." };
  }
  let master: Buffer;
  try {
    master = requireIntegrationsMasterKey();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falta la clave del cofre." };
  }
  const { keyPem, csrPem } = generarClaveYCsr({ cuit: perfil.cuit, razonSocial: perfil.razonSocial, alias });
  const blob = encryptIntegrationSecret(keyPem, master);
  const data = {
    alias,
    status: "ESPERANDO_CERTIFICADO",
    csrPem,
    keyCiphertext: blob.ciphertext,
    keyNonce: blob.nonce,
    keyAuthTag: blob.authTag,
    keyVersion: blob.keyVersion,
    certPem: null,
    certSerial: null,
    certExpiresAt: null,
    certUploadedAt: null,
    createdByUserId: ctx.actor.userId,
  };
  await prisma.$transaction([
    prisma.fotofficeArcaCredential.upsert({
      where: { workspaceId_environment: { workspaceId: ctx.workspaceId, environment } },
      create: { workspaceId: ctx.workspaceId, environment, ...data },
      update: data,
    }),
    // El ticket guardado era del certificado anterior.
    prisma.fotofficeArcaTicket.deleteMany({ where: { workspaceId: ctx.workspaceId, environment } }),
  ]);
  return { ok: true };
}

export async function leerCsr(workspaceId: string, environment: ArcaEnvironment): Promise<{ alias: string; csrPem: string } | null> {
  const c = await prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId, environment } }, select: { alias: true, csrPem: true } });
  return c;
}

function claveDe(c: { keyCiphertext: string; keyNonce: string; keyAuthTag: string; keyVersion: string }): string {
  return decryptIntegrationSecret({ ciphertext: c.keyCiphertext, nonce: c.keyNonce, authTag: c.keyAuthTag, keyVersion: c.keyVersion }, requireIntegrationsMasterKey());
}

export async function subirCertificado(ctx: Ctx, environment: ArcaEnvironment, texto: string): Promise<Resultado> {
  const [perfil, cred] = await Promise.all([
    leerPerfil(ctx.workspaceId),
    prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId: ctx.workspaceId, environment } } }),
  ]);
  if (!perfil || !cred) return { ok: false, error: "Primero generá el pedido de certificado de este ambiente." };
  let keyPem: string;
  try {
    keyPem = claveDe(cred);
  } catch {
    return { ok: false, error: "No se pudo leer la clave guardada. Generá un pedido nuevo." };
  }
  const r = revisarCertificado(texto, keyPem, perfil.cuit, new Date());
  if (!r.ok) return r;
  await prisma.$transaction([
    prisma.fotofficeArcaCredential.update({
      where: { id: cred.id },
      data: { certPem: r.certPem, certSerial: r.serial, certExpiresAt: r.venceEl, certUploadedAt: new Date(), status: "ACTIVA" },
    }),
    prisma.fotofficeArcaTicket.deleteMany({ where: { workspaceId: ctx.workspaceId, environment } }),
  ]);
  return { ok: true };
}

// --- Conexión con ARCA ------------------------------------------------------------------------

async function conexion(workspaceId: string, environment: ArcaEnvironment) {
  const [perfil, cred] = await Promise.all([
    leerPerfil(workspaceId),
    prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId, environment } } }),
  ]);
  if (!perfil) return { ok: false as const, error: "Faltan los datos fiscales del negocio." };
  if (!cred || cred.status !== "ACTIVA" || !cred.certPem) return { ok: false as const, error: "Falta subir el certificado de ARCA de este ambiente." };
  if (cred.certExpiresAt && cred.certExpiresAt.getTime() <= Date.now()) return { ok: false as const, error: "El certificado de ARCA está vencido. Generá uno nuevo." };
  let privateKey;
  try {
    privateKey = createPrivateKey(claveDe(cred));
  } catch {
    return { ok: false as const, error: "No se pudo leer la clave guardada del certificado." };
  }
  const urls = ARCA_URLS[environment];
  const transporte = crearTransporte();
  const cliente = crearClienteWsfe(urls.wsfe, transporte);
  const certPem = cred.certPem;
  const ticket = await obtenerTicket({
    deposito: depositoTicketPrisma(workspaceId, environment),
    pedir: () => pedirTicket({ transporte, url: urls.wsaa, servicio: WSFE_SERVICE, certPem, privateKey, ahora: new Date() }),
    ahora: new Date(),
  });
  if (!ticket.ok) return { ok: false as const, error: ticket.mensaje, cliente };
  const auth = { token: ticket.ticket.token, sign: ticket.ticket.sign, cuit: perfil.cuit };
  return { ok: true as const, perfil, cliente, auth, puerto: puertoArca(cliente, auth) };
}

export type PruebaConexion = { pasos: { nombre: string; ok: boolean; detalle: string }[] };

/** «Probar conexión»: FEDummy, el ticket y el último comprobante autorizado del punto de venta. */
export async function probarConexion(workspaceId: string, environment: ArcaEnvironment): Promise<PruebaConexion> {
  const pasos: PruebaConexion["pasos"] = [];
  const dummy = await crearClienteWsfe(ARCA_URLS[environment].wsfe, crearTransporte()).dummy();
  pasos.push({
    nombre: "El servicio de facturación de ARCA responde",
    ok: dummy.ok && dummy.estado.app === "OK" && dummy.estado.db === "OK" && dummy.estado.auth === "OK",
    detalle: dummy.ok ? `Aplicación ${dummy.estado.app}, base ${dummy.estado.db}, autenticación ${dummy.estado.auth}` : dummy.mensaje,
  });
  const c = await conexion(workspaceId, environment);
  pasos.push({ nombre: "ARCA reconoce el certificado", ok: c.ok, detalle: c.ok ? "Permiso de acceso vigente." : c.error });
  if (!c.ok) return { pasos };
  const pv = c.perfil.defaultPointOfSale;
  if (!pv) {
    pasos.push({ nombre: "Punto de venta", ok: false, detalle: "Falta el punto de venta en los datos fiscales." });
    return { pasos };
  }
  const ult = await c.cliente.ultimoAutorizado(c.auth, pv, CBTE_FACTURA_C);
  pasos.push({
    nombre: `Punto de venta ${pv}: última Factura C autorizada`,
    ok: ult.ok,
    detalle: ult.ok ? (ult.numero === 0 ? "Todavía no hay ninguna: la próxima es la 1." : `La última es la ${ult.numero}.`) : "sinRespuesta" in ult ? ult.mensaje : ult.errores.map((e) => `${e.code} ${e.msg}`).join(" · "),
  });
  return { pasos };
}

// --- Borradores -------------------------------------------------------------------------------

async function emisorListo(workspaceId: string): Promise<Resultado<{ perfil: NonNullable<Awaited<ReturnType<typeof leerPerfil>>>; environment: ArcaEnvironment; ptoVta: number }>> {
  const perfil = await leerPerfil(workspaceId);
  if (!perfil) return { ok: false, error: "Faltan los datos fiscales. Completalos en Configuración → Facturación electrónica." };
  if (!perfil.defaultPointOfSale) return { ok: false, error: "Falta el punto de venta en Configuración → Facturación electrónica." };
  const environment = esAmbiente(perfil.activeEnvironment) ? perfil.activeEnvironment : "HOMOLOGACION";
  const cred = await prisma.fotofficeArcaCredential.findUnique({ where: { workspaceId_environment: { workspaceId, environment } }, select: { status: true } });
  if (cred?.status !== "ACTIVA") return { ok: false, error: "Falta conectar FOTOFFICE con ARCA (el certificado) en Configuración → Facturación electrónica." };
  return { ok: true, perfil, environment, ptoVta: perfil.defaultPointOfSale };
}

function snapshot(p: NonNullable<Awaited<ReturnType<typeof leerPerfil>>>): EmisorSnapshot {
  return {
    cuit: p.cuit,
    razonSocial: p.razonSocial,
    ivaCondition: p.ivaCondition,
    domicilioFiscal: p.domicilioFiscal,
    ingresosBrutos: p.ingresosBrutos,
    inicioActividades: p.inicioActividades,
  };
}

async function crearBorrador(
  ctx: Ctx,
  args: {
    cbteTipo: CbteTipo;
    datos: DatosFormulario;
    renglones: RenglonFactura[];
    totalMinor: number;
    clientId: string | null;
    saleId?: string | null;
    pedidoId?: string | null;
    relatedInvoiceId?: string | null;
    /** Para la nota de crédito: la emite el mismo emisor, ambiente y punto de venta que la factura. */
    fijo?: { environment: ArcaEnvironment; ptoVta: number; emisor: EmisorSnapshot };
    asociado?: DatosComprobante["asociado"];
    nota: string;
  },
): Promise<Resultado<{ id: string }>> {
  let environment: ArcaEnvironment;
  let ptoVta: number;
  let emisor: EmisorSnapshot;
  if (args.fijo) {
    ({ environment, ptoVta, emisor } = args.fijo);
  } else {
    const e = await emisorListo(ctx.workspaceId);
    if (!e.ok) return e;
    environment = e.environment;
    ptoVta = e.ptoVta;
    emisor = snapshot(e.perfil);
  }
  const d = args.datos;
  const errores = validarComprobante(
    {
      cuitEmisor: emisor.cuit,
      ptoVta,
      cbteTipo: args.cbteTipo,
      numero: 1,
      concepto: d.concepto,
      docTipo: d.receptor.docTipo,
      docNro: d.receptor.docNro,
      condicionIvaReceptorId: d.receptor.condicionIvaId,
      fecha: d.fecha,
      totalCentavos: args.totalMinor,
      servicio: d.servicio,
      asociado: args.asociado ?? null,
    },
    fechaArca(new Date()),
  );
  if (errores.length) return { ok: false, error: errores.join(" ") };
  const total = minorToDecimalString(args.totalMinor);
  try {
    const f = await prisma.fotofficeInvoice.create({
      data: {
        workspaceId: ctx.workspaceId,
        environment,
        pointOfSale: ptoVta,
        cbteTipo: args.cbteTipo,
        concepto: d.concepto,
        cbteFch: d.fecha,
        servDesde: d.servicio?.desde ?? null,
        servHasta: d.servicio?.hasta ?? null,
        vtoPago: d.servicio?.vtoPago ?? null,
        clientId: args.clientId,
        receptorDocTipo: d.receptor.docTipo,
        receptorDocNro: d.receptor.docNro,
        receptorName: d.receptor.nombre,
        receptorIvaCondition: d.receptor.ivaCondition,
        receptorCondicionIvaId: d.receptor.condicionIvaId,
        receptorDomicilio: d.receptor.domicilio,
        emisorSnapshot: emisor,
        impNeto: total,
        impTotal: total,
        relatedInvoiceId: args.relatedInvoiceId ?? null,
        saleId: args.saleId ?? null,
        pedidoId: args.pedidoId ?? null,
        createdByUserId: ctx.actor.userId,
        items: {
          create: args.renglones.map((r, i) => ({
            order: i,
            description: r.description.slice(0, 500),
            qty: r.qty,
            unitPriceArs: minorToDecimalString(r.unitPriceMinor),
            lineTotalArs: minorToDecimalString(r.lineTotalMinor),
          })),
        },
        events: { create: { type: "CREADA", note: args.nota, actorUserId: ctx.actor.userId, actorLabel: ctx.actor.label } },
      },
      select: { id: true },
    });
    return { ok: true, id: f.id };
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
      return { ok: false, error: args.cbteTipo === CBTE_NOTA_CREDITO_C ? "Esa factura ya tiene una nota de crédito en curso." : "Esa venta ya tiene una factura." };
    }
    throw e;
  }
}

/** Datos del cliente para sugerir el receptor. */
export async function clienteFiscal(workspaceId: string, clientId: string | null) {
  if (!clientId) return null;
  const c = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: { kind: true, firstName: true, lastName: true, businessName: true, docType: true, docNumber: true, ivaCondition: true, address: true, city: true },
  });
  if (!c) return null;
  return {
    nombre: clientDisplayName(c),
    docType: c.docType,
    docNumber: c.docNumber,
    ivaCondition: c.ivaCondition,
    domicilio: [c.address, c.city].filter(Boolean).join(", ") || null,
  };
}

export async function ventaParaFacturar(workspaceId: string, saleId: string) {
  const s = await prisma.sale.findFirst({
    where: { id: saleId, workspaceId },
    select: { id: true, saleNumber: true, status: true, clientId: true, totalArs: true, occurredAt: true, items: { select: { description: true, qty: true, unitPriceArs: true, lineTotalArs: true } } },
  });
  if (!s) return null;
  const items = s.items.map((i) => ({ description: i.description, qty: i.qty, unitPriceMinor: decimalArsToMinor(i.unitPriceArs), lineTotalMinor: decimalArsToMinor(i.lineTotalArs) }));
  const totalMinor = decimalArsToMinor(s.totalArs);
  return { ...s, totalMinor, renglones: renglonesDeVenta(items, totalMinor) };
}

export async function pedidoParaFacturar(workspaceId: string, pedidoId: string) {
  const p = await prisma.fotofficePedido.findFirst({
    where: { id: pedidoId, workspaceId },
    select: { id: true, number: true, status: true, clientId: true, totalArs: true, eventDate: true, eventLabel: true },
  });
  if (!p) return null;
  const facturado = await prisma.fotofficeInvoice.findMany({
    where: { workspaceId, pedidoId, cbteTipo: CBTE_FACTURA_C, status: { in: ["BORRADOR", "PENDIENTE", "AUTORIZADA"] } },
    select: { impTotal: true },
  });
  const totalMinor = decimalArsToMinor(p.totalArs);
  const facturadoMinor = facturado.reduce((a, f) => a + decimalArsToMinor(f.impTotal), 0);
  return { ...p, totalMinor, facturadoMinor, saldoMinor: Math.max(0, totalMinor - facturadoMinor) };
}

export async function facturarVenta(ctx: Ctx, saleId: string, datos: DatosFormulario): Promise<Resultado<{ id: string; emision: ResultadoEmision | null }>> {
  const v = await ventaParaFacturar(ctx.workspaceId, saleId);
  if (!v) return { ok: false, error: "No encontramos esa venta." };
  if (v.status !== "COMPLETADA") return { ok: false, error: "Una venta anulada no se factura." };
  const b = await crearBorrador(ctx, {
    cbteTipo: CBTE_FACTURA_C,
    datos,
    renglones: v.renglones,
    totalMinor: v.totalMinor,
    clientId: v.clientId,
    saleId: v.id,
    nota: `Factura de la venta #${v.saleNumber}.`,
  });
  if (!b.ok) return b;
  return { ok: true, id: b.id, emision: await emitirComprobante(ctx, b.id) };
}

export async function facturarPedido(
  ctx: Ctx,
  pedidoId: string,
  datos: DatosFormulario,
  montoMinor: number,
  descripcion: string,
): Promise<Resultado<{ id: string; emision: ResultadoEmision | null }>> {
  const p = await pedidoParaFacturar(ctx.workspaceId, pedidoId);
  if (!p) return { ok: false, error: "No encontramos ese pedido." };
  if (p.status === "CANCELADO") return { ok: false, error: "Un pedido cancelado no se factura." };
  if (!Number.isInteger(montoMinor) || montoMinor <= 0) return { ok: false, error: "El importe a facturar tiene que ser mayor a cero." };
  if (montoMinor > p.saldoMinor) return { ok: false, error: "El importe supera lo que falta facturar de este pedido." };
  const texto = descripcion.trim().slice(0, 500) || `Pedido ${p.number}${p.eventLabel ? ` — ${p.eventLabel}` : ""}`;
  const b = await crearBorrador(ctx, {
    cbteTipo: CBTE_FACTURA_C,
    datos,
    renglones: [{ description: texto, qty: 1, unitPriceMinor: montoMinor, lineTotalMinor: montoMinor }],
    totalMinor: montoMinor,
    clientId: p.clientId,
    pedidoId: p.id,
    nota: `Factura del pedido ${p.number}.`,
  });
  if (!b.ok) return b;
  return { ok: true, id: b.id, emision: await emitirComprobante(ctx, b.id) };
}

/** «Anular»: una Nota de crédito C por el total, que referencia la factura. */
export async function anularConNotaDeCredito(ctx: Ctx, facturaId: string, motivo: string): Promise<Resultado<{ id: string; emision: ResultadoEmision | null }>> {
  const f = await prisma.fotofficeInvoice.findFirst({ where: { id: facturaId, workspaceId: ctx.workspaceId }, include: { items: { orderBy: { order: "asc" } } } });
  if (!f || f.cbteTipo !== CBTE_FACTURA_C) return { ok: false, error: "No encontramos esa factura." };
  if (f.status !== "AUTORIZADA" || f.cbteNumero === null) return { ok: false, error: "Sólo se anula una factura autorizada." };
  if (!esAmbiente(f.environment)) return { ok: false, error: "Ambiente desconocido." };
  const hoy = fechaArca(new Date());
  const emisor = f.emisorSnapshot as unknown as EmisorSnapshot;
  const datos: DatosFormulario = {
    receptor: {
      docTipo: f.receptorDocTipo,
      docNro: f.receptorDocNro,
      nombre: f.receptorName,
      ivaCondition: f.receptorIvaCondition,
      condicionIvaId: f.receptorCondicionIvaId,
      domicilio: f.receptorDomicilio,
    },
    concepto: f.concepto as 1 | 2 | 3,
    fecha: hoy,
    servicio: f.servDesde && f.servHasta && f.vtoPago ? { desde: f.servDesde, hasta: f.servHasta, vtoPago: f.vtoPago > hoy ? f.vtoPago : hoy } : null,
  };
  const b = await crearBorrador(ctx, {
    cbteTipo: CBTE_NOTA_CREDITO_C,
    datos,
    renglones: f.items.map((i) => ({ description: i.description, qty: i.qty, unitPriceMinor: decimalArsToMinor(i.unitPriceArs), lineTotalMinor: decimalArsToMinor(i.lineTotalArs) })),
    totalMinor: decimalArsToMinor(f.impTotal),
    clientId: f.clientId,
    saleId: f.saleId,
    pedidoId: f.pedidoId,
    relatedInvoiceId: f.id,
    fijo: { environment: f.environment, ptoVta: f.pointOfSale, emisor },
    asociado: { tipo: CBTE_FACTURA_C, ptoVta: f.pointOfSale, numero: f.cbteNumero, cuit: emisor.cuit, fecha: f.cbteFch },
    nota: `Anula la factura ${f.cbteNumero}. Motivo: ${motivo.trim().slice(0, 300) || "sin motivo escrito"}.`,
  });
  if (!b.ok) return b;
  return { ok: true, id: b.id, emision: await emitirComprobante(ctx, b.id) };
}

// --- Emitir y conciliar -----------------------------------------------------------------------

export async function emitirComprobante(ctx: Ctx, id: string): Promise<ResultadoEmision> {
  const f = await prisma.fotofficeInvoice.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { environment: true } });
  if (!f || !esAmbiente(f.environment)) return { estado: "NO_ENVIADA", error: "No encontramos ese comprobante." };
  const c = await conexion(ctx.workspaceId, f.environment);
  if (!c.ok) return { estado: "NO_ENVIADA", error: c.error };
  return emitir(puertoBasePrisma(ctx.workspaceId, f.environment, ctx.actor), c.puerto, id);
}

export async function conciliarComprobante(ctx: Ctx, id: string): Promise<ResultadoConciliacion | { estado: "ERROR"; detalle: string }> {
  const f = await prisma.fotofficeInvoice.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { environment: true } });
  if (!f || !esAmbiente(f.environment)) return { estado: "ERROR", detalle: "No encontramos ese comprobante." };
  const base = puertoBasePrisma(ctx.workspaceId, f.environment, ctx.actor);
  const comp = await base.leer(id);
  if (!comp) return { estado: "ERROR", detalle: "No encontramos ese comprobante." };
  const c = await conexion(ctx.workspaceId, f.environment);
  if (!c.ok) return { estado: "ERROR", detalle: c.error };
  return conciliar(base, c.puerto, comp, new Date());
}

// --- Lecturas para pantallas ------------------------------------------------------------------

export async function listarComprobantes(workspaceId: string, opts: { take?: number } = {}) {
  return prisma.fotofficeInvoice.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: "desc" }],
    take: opts.take ?? 200,
    select: {
      id: true,
      environment: true,
      pointOfSale: true,
      cbteTipo: true,
      cbteNumero: true,
      cbteFch: true,
      receptorName: true,
      impTotal: true,
      status: true,
      cae: true,
      saleId: true,
      pedidoId: true,
      relatedInvoiceId: true,
      sentAt: true,
      createdAt: true,
      events: { orderBy: { createdAt: "desc" }, take: 1, select: { type: true, note: true } },
    },
  });
}

/** Las facturas vivas por venta o por pedido, para el cartel «Facturada» en Ventas y Pedidos. */
export async function facturasDe(workspaceId: string, filtro: { saleIds?: string[]; pedidoId?: string }) {
  if (!filtro.pedidoId && !(filtro.saleIds && filtro.saleIds.length)) return [];
  return prisma.fotofficeInvoice.findMany({
    where: {
      workspaceId,
      cbteTipo: CBTE_FACTURA_C,
      status: { in: ["BORRADOR", "PENDIENTE", "AUTORIZADA", "ANULADA"] },
      ...(filtro.pedidoId ? { pedidoId: filtro.pedidoId } : { saleId: { in: filtro.saleIds } }),
    },
    select: { id: true, saleId: true, pedidoId: true, pointOfSale: true, cbteNumero: true, status: true, environment: true, impTotal: true },
  });
}
