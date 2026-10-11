import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import { correoValido } from "@/lib/plantillas/contexto";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import type { CtxGalerias } from "./acceso";
import { almacenZipR2, urlDeDescargaParte, type AlmacenZip } from "./almacen-descargas";
import { urlDeDescargaOriginal } from "./almacen";
import { enviarCorreoGaleria, type ResultadoCorreoGaleria } from "./correos";
import { tamanoMaximoDe, type TipoMedio } from "./constantes";
import {
  BLOQUE_SUBIDA, DIAS_VIGENCIA_DESCARGA, MAX_INTENTOS_PARTE, MAX_PEDIDOS_POR_DIA, MENSAJES_DESCARGA as M, MINUTOS_CANDADO,
  analizarClaveDeParte, claveDeParte, esClaveDeParte, formatearBytes, planificarPartes,
  type EstadoDescarga, type ParteDescarga,
} from "./descargas-reglas";
import { hashDeToken, resolverClaveDeEnlace, tokenDeGaleriaCliente } from "./enlace";
import { registrarEventoSinFallar } from "./eventos";
import { ordenarFotosDeGaleria } from "./orden";
import { resolverTokenGaleria } from "./publico";
import { nombreDeOriginal } from "./publico-tipos";
import { enBloques, zipEnFlujo, type ArchivoParaZip } from "./zip";

/**
 * «Recibir todo por correo» (etapa 7, Entrega B): el pedido de descarga completa de una galería de ENTREGA.
 *
 * Ciclo de vida de `FotofficeGaleriaDescarga.status`:
 *   PENDIENTE → ARMANDO (una corrida del cron lo toma) → [una parte por corrida; vuelve a PENDIENTE mientras falten]
 *   → LISTA (+ correo) → VENCIDA a los 7 días (se borran las partes). Si una parte falla 3 veces → ERROR.
 *
 * Cómo se arma (una parte por corrida del cron, `maxDuration` 300 s):
 *  - el PLAN (qué archivos van en qué parte) se fija al crear el pedido y queda en `parts`;
 *  - cada parte se escribe en el R2 privado con subida multiparte, leyendo cada original en flujo y calculando el
 *    CRC mientras pasa (memoria acotada: un bloque de 16 MB subiendo y otro armándose);
 *  - el candado es el propio `status`: ARMANDO con `updatedAt` de más de 6 minutos (la corrida murió) lo retoma otra;
 *    mientras se arma, un latido refresca `updatedAt` cada minuto;
 *  - RETOMAR = REHACER: si una corrida murió a mitad de una parte, la siguiente aborta la subida multiparte que quedó
 *    colgada (`cursor.uploadId`) y arma esa parte DESDE CERO. Es más simple y siempre correcto (un ZIP a medias no
 *    se puede continuar porque el CRC y el directorio central dependen de todo lo anterior). Cada muerte o falla
 *    cuenta como un intento; a los 3 el pedido queda en ERROR.
 */

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;
/**
 * Presupuesto de TODA la corrida (vencer + armar + cerrar + avisar), contado desde que arranca `procesarDescargas`:
 * Vercel mata la función a los 300 s. La parte se corta a propósito para dejar `RESERVA_CIERRE_MS` a completar la
 * subida, cerrar el pedido y mandar el aviso; vencer y avisar tienen su propio tope chico.
 */
const PRESUPUESTO_CORRIDA_MS = 270_000;
const RESERVA_CIERRE_MS = 30_000;
/** Menos que esto de margen y no se empieza a armar una parte: queda para la próxima corrida. */
const MINIMO_PARA_ARMAR_MS = 30_000;
const PRESUPUESTO_VENCER_MS = 25_000;
/** Aviso de «descarga lista»: reintentos, espera entre ellos y arriendo de la reserva. */
const MAX_INTENTOS_AVISO = 12;
const ESPERA_AVISO_MS = 30 * MINUTO;
const ARRIENDO_AVISO_MS = 10 * MINUTO;
const LATIDO_MS = 60_000;
const AR = "America/Argentina/Buenos_Aires";

// --- Forma de las filas ----------------------------------------------------------------------------------

type Cursor = { n: number; uploadId: string | null; intentos: number };

function aPartes(v: unknown): ParteDescarga[] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is ParteDescarga => !!p && typeof p === "object" && ((p as { tipo?: unknown }).tipo === "ZIP" || (p as { tipo?: unknown }).tipo === "SUELTO"));
}
function aCursor(v: unknown): Cursor | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<Cursor>;
  if (typeof c.n !== "number") return null;
  return { n: c.n, uploadId: typeof c.uploadId === "string" ? c.uploadId : null, intentos: typeof c.intentos === "number" ? c.intentos : 0 };
}
const json = (v: unknown) => v as Prisma.InputJsonValue;

export function fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: AR, dateStyle: "long" }).format(d);
}
export function fechaConHora(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: AR, dateStyle: "long", timeStyle: "short" }).format(d);
}

const nuevoId = () => `dl${randomBytes(12).toString("base64url")}`;

// --- Crear el pedido -------------------------------------------------------------------------------------

export type ResultadoPedido =
  | { ok: true; id: string; yaEnCurso: boolean }
  | { ok: false; error: string; codigo: "NO_ENTREGA" | "SIN_ARCHIVOS" | "TOPE" | "GENERICO" };

type EntradaPedido = { workspaceId: string; galeriaId: string; galeriaClienteId: string | null; requestedEmail: string | null; actorUserId?: number | null };

/**
 * Crea un pedido de descarga completa (sólo galerías de ENTREGA) con su plan de partes. Un solo pedido activo a la
 * vez por cliente (el del estudio cuenta como «sin cliente») y como mucho 3 por día, contados en las últimas 24 h.
 * Si ya hay uno armándose devuelve ese. Nunca guarda nombres, sólo el correo al que avisar.
 */
export async function crearPedidoDescarga(e: EntradaPedido, ahora: Date = new Date()): Promise<ResultadoPedido> {
  try {
    const g = await prisma.fotofficeGaleria.findFirst({ where: { id: e.galeriaId, workspaceId: e.workspaceId }, select: { id: true, kind: true, orderMode: true } });
    if (!g || g.kind !== "ENTREGA") return { ok: false, error: M.soloEntrega, codigo: "NO_ENTREGA" };
    const alcance = { workspaceId: e.workspaceId, galeriaId: g.id, galeriaClienteId: e.galeriaClienteId };
    const activo = await prisma.fotofficeGaleriaDescarga.findFirst({ where: { ...alcance, status: { in: ["PENDIENTE", "ARMANDO"] } }, select: { id: true } });
    if (activo) return { ok: true, id: activo.id, yaEnCurso: true };
    const hoy = await prisma.fotofficeGaleriaDescarga.count({ where: { ...alcance, createdAt: { gte: new Date(ahora.getTime() - DIA) } } });
    if (hoy >= MAX_PEDIDOS_POR_DIA) return { ok: false, error: M.tope, codigo: "TOPE" };
    const fotos = await prisma.fotofficeGaleriaFoto.findMany({
      where: { workspaceId: e.workspaceId, galeriaId: g.id, status: "LISTA" },
      select: { id: true, fileName: true, order: true, sizeBytes: true, mediaType: true },
    });
    if (fotos.length === 0) return { ok: false, error: M.sinArchivos, codigo: "SIN_ARCHIVOS" };
    const orden = ordenarFotosDeGaleria(fotos, g.orderMode === "MANUAL" ? "MANUAL" : "NOMBRE");
    const id = nuevoId();
    const plan = planificarPartes(
      orden.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        // Sin tamaño guardado (no debería pasar con una foto LISTA) se asume el máximo de su tipo, a favor de la seguridad.
        bytes: f.sizeBytes === null || f.sizeBytes === undefined ? tamanoMaximoDe((f.mediaType === "VIDEO" ? "VIDEO" : "FOTO") as TipoMedio) : Number(f.sizeBytes),
      })),
      (n) => claveDeParte(e.workspaceId, g.id, id, n),
    );
    const sinZip = plan.partes.every((p) => p.tipo === "SUELTO");
    await prisma.fotofficeGaleriaDescarga.create({
      data: {
        id,
        workspaceId: e.workspaceId,
        galeriaId: g.id,
        galeriaClienteId: e.galeriaClienteId,
        status: sinZip ? "LISTA" : "PENDIENTE",
        totalFiles: plan.totalFiles,
        totalBytes: BigInt(plan.totalBytes),
        parts: json(plan.partes),
        requestedEmail: e.requestedEmail,
        createdAt: ahora,
        updatedAt: ahora,
        // Mientras se arma, un vencimiento lejano; se vuelve a fijar a 7 días cuando queda LISTA.
        expiresAt: new Date(ahora.getTime() + DIAS_VIGENCIA_DESCARGA * DIA),
      },
      select: { id: true },
    });
    await registrarEventoSinFallar({
      workspaceId: e.workspaceId, galeriaId: g.id, galeriaClienteId: e.galeriaClienteId, actorUserId: e.actorUserId ?? null,
      tipo: "DESCARGA_PEDIDA", data: { descargaId: id, archivos: plan.totalFiles, partes: plan.partes.filter((p) => p.tipo === "ZIP").length },
    });
    return { ok: true, id, yaEnCurso: false };
  } catch (err) {
    console.error("[galerias] no se pudo crear el pedido de descarga", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
    return { ok: false, error: M.generico, codigo: "GENERICO" };
  }
}

/** Del enlace del cliente: pide la descarga completa a su correo. Exige galería de ENTREGA publicada y un correo válido. */
export async function pedirDescargaDeCliente(workspaceId: string, token: unknown, ahora: Date = new Date()): Promise<ResultadoPedido> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok) return { ok: false, error: "Este enlace ya no es válido.", codigo: "GENERICO" };
  if (r.galeria.kind !== "ENTREGA") return { ok: false, error: M.soloEntrega, codigo: "NO_ENTREGA" };
  if (!correoValido(r.cliente.email ?? "")) return { ok: false, error: M.sinCorreo, codigo: "GENERICO" };
  return crearPedidoDescarga({ workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id, requestedEmail: r.cliente.email }, ahora);
}

// --- Lo que ve el cliente --------------------------------------------------------------------------------

export type EstadoParaCliente = {
  tieneCorreo: boolean;
  /** Hay un pedido armándose o en espera. */
  activa: boolean;
  /** Hay una descarga lista que todavía no venció. */
  lista: boolean;
  /** Pedidos hechos en las últimas 24 h. */
  pedidosHoy: number;
  topeAlcanzado: boolean;
};

export async function estadoDescargaDeCliente(workspaceId: string, galeriaId: string, galeriaClienteId: string, email: string | null, ahora: Date = new Date()): Promise<EstadoParaCliente> {
  const filas = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { workspaceId, galeriaId, galeriaClienteId, createdAt: { gte: new Date(ahora.getTime() - 7 * DIA) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { status: true, createdAt: true, expiresAt: true },
  });
  const desde = ahora.getTime() - DIA;
  const pedidosHoy = filas.filter((f) => f.createdAt.getTime() >= desde).length;
  return {
    tieneCorreo: correoValido(email ?? ""),
    activa: filas.some((f) => f.status === "PENDIENTE" || f.status === "ARMANDO"),
    lista: filas.some((f) => f.status === "LISTA" && f.expiresAt.getTime() > ahora.getTime()),
    pedidosHoy,
    topeAlcanzado: pedidosHoy >= MAX_PEDIDOS_POR_DIA,
  };
}

export type ParteVista = { n: number; tipo: "ZIP" | "SUELTO"; etiqueta: string; bytes: number; tamano: string; archivos: number };
export type VistaDescargas = {
  galeria: { nombre: string };
  cliente: { nombre: string };
  estado: "LISTA" | "ARMANDO" | "ERROR" | "VENCIDA" | "NINGUNA";
  descargaId: string | null;
  venceEl: string | null;
  partes: ParteVista[];
};

function partesVista(partes: ParteDescarga[], soloListas: boolean): ParteVista[] {
  return partes
    .filter((p) => !soloListas || p.estado === "LISTA")
    .map((p) =>
      p.tipo === "ZIP"
        ? { n: p.n, tipo: "ZIP" as const, etiqueta: `Parte ${p.n}`, bytes: p.bytes, tamano: formatearBytes(p.bytes), archivos: p.files }
        : { n: p.n, tipo: "SUELTO" as const, etiqueta: p.nombre, bytes: p.bytes, tamano: formatearBytes(p.bytes), archivos: 1 },
    );
}

/**
 * La página /descargas del cliente: la última descarga LISTA y vigente de ESTE cliente (o, si no hay, el estado
 * de la más reciente). Todo se acota por workspace, galería y cliente del token: nunca se lee la de otro.
 */
export async function vistaDeDescargas(workspaceId: string, token: unknown, ahora: Date = new Date()): Promise<VistaDescargas | null> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok || r.galeria.kind !== "ENTREGA") return null;
  const filas = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
    select: { id: true, status: true, parts: true, expiresAt: true },
  });
  const base = { galeria: { nombre: r.galeria.name }, cliente: { nombre: r.cliente.name } };
  const vigente = filas.find((f) => f.status === "LISTA" && f.expiresAt.getTime() > ahora.getTime());
  if (vigente) {
    return { ...base, estado: "LISTA", descargaId: vigente.id, venceEl: fechaCorta(vigente.expiresAt), partes: partesVista(aPartes(vigente.parts), true) };
  }
  const ultima = filas[0];
  if (!ultima) return { ...base, estado: "NINGUNA", descargaId: null, venceEl: null, partes: [] };
  const estado: EstadoDescarga = ultima.status === "LISTA" ? "VENCIDA" : (ultima.status as EstadoDescarga);
  return {
    ...base,
    estado: estado === "PENDIENTE" || estado === "ARMANDO" ? "ARMANDO" : estado === "ERROR" ? "ERROR" : "VENCIDA",
    descargaId: null,
    venceEl: null,
    partes: [],
  };
}

export type SalidaUrl = { ok: true; url: string } | { ok: false; error: string };

/** Nombre del ZIP que baja el cliente: el de la galería con la parte, sin caracteres raros. */
function nombreDeZip(galeria: string, n: number): string {
  const base = nombreDeOriginal(galeria).utf8.replace(/\.+$/, "").slice(0, 80) || "descarga";
  return `${base}-parte-${n}.zip`;
}

/**
 * Firma (5 minutos, attachment) UNA parte de una descarga del cliente del token. Se vuelve a validar todo al
 * hacer clic: token, que la descarga sea de ese cliente, esté LISTA y no haya vencido, y que la clave de la parte
 * sea de esa galería y esa descarga. Un id de otra galería, cliente u organización da siempre el mismo error.
 */
export async function urlDeParteDeCliente(workspaceId: string, token: unknown, descargaId: unknown, tipo: unknown, n: unknown, ahora: Date = new Date()): Promise<SalidaUrl> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok || r.galeria.kind !== "ENTREGA") return { ok: false, error: "Este enlace ya no es válido." };
  if (typeof descargaId !== "string" || !descargaId || descargaId.length > 60 || (tipo !== "ZIP" && tipo !== "SUELTO") || typeof n !== "number" || !Number.isInteger(n)) {
    return { ok: false, error: M.parteInvalida };
  }
  const d = await prisma.fotofficeGaleriaDescarga.findFirst({
    where: { id: descargaId, workspaceId, galeriaId: r.galeria.id, galeriaClienteId: r.cliente.id },
    select: { id: true, status: true, parts: true, expiresAt: true },
  });
  if (!d || d.status !== "LISTA" || d.expiresAt.getTime() <= ahora.getTime()) return { ok: false, error: M.noDisponible };
  return firmarParte({ workspaceId, galeriaId: r.galeria.id, nombreGaleria: r.galeria.name, descargaId: d.id, partes: aPartes(d.parts), tipo, n });
}

async function firmarParte(a: { workspaceId: string; galeriaId: string; nombreGaleria: string; descargaId: string; partes: ParteDescarga[]; tipo: "ZIP" | "SUELTO"; n: number }): Promise<SalidaUrl> {
  const parte = a.partes.find((p) => p.tipo === a.tipo && p.n === a.n && p.estado === "LISTA");
  if (!parte) return { ok: false, error: M.parteInvalida };
  try {
    if (parte.tipo === "SUELTO") {
      const foto = await prisma.fotofficeGaleriaFoto.findFirst({
        where: { id: parte.fotoId, workspaceId: a.workspaceId, galeriaId: a.galeriaId, status: "LISTA" },
        select: { originalKey: true, fileName: true },
      });
      if (!foto?.originalKey) return { ok: false, error: M.parteInvalida };
      return { ok: true, url: await urlDeDescargaOriginal(foto.originalKey, nombreDeOriginal(foto.fileName)) };
    }
    const c = analizarClaveDeParte(parte.key);
    if (!c || c.workspaceId !== a.workspaceId || c.galeriaId !== a.galeriaId || c.descargaId !== a.descargaId || c.n !== parte.n) return { ok: false, error: M.parteInvalida };
    return { ok: true, url: await urlDeDescargaParte(parte.key, nombreDeZip(a.nombreGaleria, parte.n)) };
  } catch {
    return { ok: false, error: M.generico };
  }
}

// --- El estudio ------------------------------------------------------------------------------------------

export type DescargaDeEstudio = {
  id: string;
  estado: EstadoDescarga;
  creada: string;
  vence: string | null;
  archivos: number;
  tamano: string;
  quien: string;
  error: string | null;
  partes: ParteVista[];
  /** Partes ya armadas (para «3 de 5»). */
  armadas: number;
  totalPartes: number;
};

/** Los últimos pedidos de descarga de una galería, para su ficha. Acotado al workspace de la sesión. */
export async function listarDescargasDeGaleria(ctx: CtxGalerias, galeriaId: string, ahora: Date = new Date()): Promise<DescargaDeEstudio[]> {
  const filas = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { workspaceId: ctx.workspaceId, galeriaId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
    select: { id: true, status: true, createdAt: true, expiresAt: true, totalFiles: true, totalBytes: true, parts: true, errorReason: true, galeriaClienteId: true },
  });
  const idsClientes = [...new Set(filas.map((f) => f.galeriaClienteId).filter((x): x is string => !!x))];
  const clientes = idsClientes.length
    ? await prisma.fotofficeGaleriaCliente.findMany({ where: { workspaceId: ctx.workspaceId, galeriaId, id: { in: idsClientes } }, select: { id: true, name: true } })
    : [];
  const nombres = new Map(clientes.map((c) => [c.id, c.name]));
  return filas.map((f) => {
    const partes = aPartes(f.parts);
    const vencida = f.status === "LISTA" && f.expiresAt.getTime() <= ahora.getTime();
    const estado = (vencida ? "VENCIDA" : f.status) as EstadoDescarga;
    const zips = partes.filter((p) => p.tipo === "ZIP");
    return {
      id: f.id,
      estado,
      creada: fechaConHora(f.createdAt),
      vence: estado === "LISTA" ? fechaCorta(f.expiresAt) : null,
      archivos: f.totalFiles,
      tamano: formatearBytes(Number(f.totalBytes)),
      quien: f.galeriaClienteId ? `Cliente: ${nombres.get(f.galeriaClienteId) ?? "—"}` : "Pedida por el estudio",
      error: f.status === "ERROR" ? (f.errorReason ?? M.generico) : null,
      partes: estado === "LISTA" ? partesVista(partes, true) : [],
      armadas: zips.filter((p) => p.estado === "LISTA").length,
      totalPartes: zips.length,
    };
  });
}

/** «Preparar descarga» del estudio: el aviso sale al correo del usuario que la pidió. */
export async function prepararDescargaDelEstudio(ctx: CtxGalerias, galeriaId: string, ahora: Date = new Date()): Promise<ResultadoPedido> {
  if (ctx.userId === null) return { ok: false, error: "No tenés permiso para hacer esto.", codigo: "GENERICO" };
  const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  return crearPedidoDescarga(
    { workspaceId: ctx.workspaceId, galeriaId, galeriaClienteId: null, requestedEmail: correoValido(u?.email ?? "") ? (u?.email ?? null) : null, actorUserId: ctx.userId },
    ahora,
  );
}

/** Enlace firmado de una parte, para el estudio (acotado al workspace y a la galería). */
export async function urlDeParteDelEstudio(ctx: CtxGalerias, galeriaId: string, descargaId: string, tipo: "ZIP" | "SUELTO", n: number, ahora: Date = new Date()): Promise<SalidaUrl> {
  const d = await prisma.fotofficeGaleriaDescarga.findFirst({
    where: { id: descargaId, workspaceId: ctx.workspaceId, galeriaId },
    select: { id: true, status: true, parts: true, expiresAt: true },
  });
  if (!d || d.status !== "LISTA" || d.expiresAt.getTime() <= ahora.getTime()) return { ok: false, error: M.noDisponible };
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, select: { name: true } });
  if (!g) return { ok: false, error: M.noDisponible };
  return firmarParte({ workspaceId: ctx.workspaceId, galeriaId, nombreGaleria: g.name, descargaId: d.id, partes: aPartes(d.parts), tipo, n });
}

// --- El cron ---------------------------------------------------------------------------------------------

export type DepsDescargas = {
  almacen?: AlmacenZip;
  /** Manda el correo de «descarga lista». Por omisión el real. */
  avisar?: (descargaId: string, ahora: Date) => Promise<unknown>;
  ahora?: () => Date;
  appOrigin?: string;
  /** Para las pruebas: otro presupuesto de tiempo por parte. */
  presupuestoMs?: number;
  /** Para las pruebas: otro tamaño de bloque. */
  bloque?: number;
};

export type ResumenCronDescargas = {
  vencidas: number;
  tomada: string | null;
  parteArmada: number | null;
  terminada: boolean;
  fallo: boolean;
  avisadas: number;
};

/**
 * Una pasada del cron de descargas: (1) vence lo vencido y borra sus partes; (2) toma UN pedido (PENDIENTE o
 * ARMANDO muerto) y arma UNA parte; (3) avisa los que quedaron LISTA sin aviso. Idempotente y segura si dos
 * corridas se pisan: el candado es una escritura condicional.
 */
export async function procesarDescargas(deps: DepsDescargas = {}): Promise<ResumenCronDescargas> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const almacen = deps.almacen ?? almacenZipR2;
  const resumen: ResumenCronDescargas = { vencidas: 0, tomada: null, parteArmada: null, terminada: false, fallo: false, avisadas: 0 };
  const arranque = Date.now();
  const transcurrido = () => Date.now() - arranque;

  resumen.vencidas = await vencerDescargas(ahora, almacen, Date.now() + PRESUPUESTO_VENCER_MS);

  const corte = new Date(ahora.getTime() - MINUTOS_CANDADO * MINUTO);
  const candidatos = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { OR: [{ status: "PENDIENTE" }, { status: "ARMANDO", updatedAt: { lt: corte } }] },
    // Turnos parejos: el que acaba de armar una parte (su `updatedAt` es nuevo) pasa al final de la cola, así un pedido
    // enorme no deja sin servicio a los demás.
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 5,
    select: { id: true, status: true },
  });
  // Con poco margen no se empieza una parte (se perdería el cierre): queda para la próxima corrida.
  const presupuestoParte = deps.presupuestoMs ?? PRESUPUESTO_CORRIDA_MS - RESERVA_CIERRE_MS - transcurrido();
  for (const c of candidatos) {
    if (deps.presupuestoMs === undefined && presupuestoParte < MINIMO_PARA_ARMAR_MS) break;
    // Candado: sólo uno gana la escritura condicional.
    const tomado = await prisma.fotofficeGaleriaDescarga.updateMany({
      where: c.status === "PENDIENTE" ? { id: c.id, status: "PENDIENTE" } : { id: c.id, status: "ARMANDO", updatedAt: { lt: corte } },
      data: { status: "ARMANDO", updatedAt: ahora },
    });
    if (tomado.count === 0) continue;
    resumen.tomada = c.id;
    const r = await trabajarPedido(c.id, ahora, almacen, { ...deps, presupuestoMs: presupuestoParte });
    Object.assign(resumen, r);
    break;
  }

  if (PRESUPUESTO_CORRIDA_MS - transcurrido() > 10_000) resumen.avisadas = await avisarPendientes(ahora, deps);
  return resumen;
}

async function vencerDescargas(ahora: Date, almacen: AlmacenZip, limite: number): Promise<number> {
  const filas = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { status: { in: ["LISTA", "ERROR"] }, expiresAt: { lte: ahora } },
    orderBy: { expiresAt: "asc" },
    take: 20,
    select: { id: true, workspaceId: true, galeriaId: true, status: true, parts: true, cursor: true },
  });
  let n = 0;
  for (const f of filas) {
    if (Date.now() > limite) break;
    try {
      for (const p of aPartes(f.parts)) {
        // Sólo se borra una clave que realmente sea de una parte de ESTA descarga.
        if (p.tipo === "ZIP" && esClaveDeParte(p.key) && analizarClaveDeParte(p.key)?.descargaId === f.id) await almacen.borrar(p.key);
      }
      const c = aCursor(f.cursor);
      if (c?.uploadId) {
        const parte = aPartes(f.parts).find((p) => p.tipo === "ZIP" && p.n === c.n);
        if (parte?.tipo === "ZIP") await almacen.abortarMultiparte(parte.key, c.uploadId);
      }
      const r = await prisma.fotofficeGaleriaDescarga.updateMany({ where: { id: f.id, status: f.status }, data: { status: "VENCIDA", cursor: Prisma.DbNull } });
      if (r.count > 0) n++;
    } catch (err) {
      // Queda para la próxima pasada.
      console.error("[galerias] no se pudieron borrar las partes vencidas", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
    }
  }
  return n;
}

async function trabajarPedido(id: string, ahora: Date, almacen: AlmacenZip, deps: DepsDescargas): Promise<Partial<ResumenCronDescargas>> {
  const d = await prisma.fotofficeGaleriaDescarga.findFirst({
    where: { id, status: "ARMANDO" },
    select: { id: true, workspaceId: true, galeriaId: true, galeriaClienteId: true, parts: true, cursor: true },
  });
  if (!d) return {};
  const partes = aPartes(d.parts);
  const siguiente = partes.find((p): p is Extract<ParteDescarga, { tipo: "ZIP" }> => p.tipo === "ZIP" && p.estado === "PENDIENTE");
  if (!siguiente) {
    // Nada que armar (todas listas o sólo archivos sueltos): se cierra.
    await terminar(d, partes, ahora, deps);
    return { terminada: true };
  }

  // Si una corrida anterior murió con una subida a medias, se aborta y se rehace la parte desde cero.
  const previo = aCursor(d.cursor);
  let intentos = previo && previo.n === siguiente.n ? previo.intentos : 0;
  if (previo?.uploadId) {
    const vieja = partes.find((p) => p.tipo === "ZIP" && p.n === previo.n);
    try {
      if (vieja?.tipo === "ZIP") await almacen.abortarMultiparte(vieja.key, previo.uploadId);
    } catch (err) {
      console.error("[galerias] no se pudo abortar una subida colgada", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
    }
    intentos++;
  }
  if (intentos >= MAX_INTENTOS_PARTE) {
    await fallar(d, siguiente.n, intentos, "No se pudo armar una de las partes después de varios intentos.", ahora);
    return { fallo: true };
  }

  try {
    const hecha = await armarParte(d, siguiente, intentos, ahora, almacen, deps);
    // Se actualiza la parte y se sigue o se termina. Si perdimos el candado (count 0) no se pisa lo del otro.
    const nuevas: ParteDescarga[] = partes.flatMap((p): ParteDescarga[] => {
      if (p.tipo !== "ZIP" || p.n !== siguiente.n) return [p];
      return hecha.files === 0 ? [] : [{ ...p, estado: "LISTA", bytes: hecha.bytes, files: hecha.files }];
    });
    const quedan = nuevas.some((p) => p.tipo === "ZIP" && p.estado === "PENDIENTE");
    if (quedan) {
      const r = await prisma.fotofficeGaleriaDescarga.updateMany({
        where: { id: d.id, status: "ARMANDO" },
        data: { parts: json(nuevas), cursor: Prisma.DbNull, status: "PENDIENTE", updatedAt: (deps.ahora ?? (() => new Date()))() },
      });
      return { parteArmada: r.count > 0 ? siguiente.n : null };
    }
    await prisma.fotofficeGaleriaDescarga.updateMany({ where: { id: d.id, status: "ARMANDO" }, data: { parts: json(nuevas), cursor: Prisma.DbNull } });
    await terminar(d, nuevas, (deps.ahora ?? (() => new Date()))(), deps);
    return { parteArmada: siguiente.n, terminada: true };
  } catch (err) {
    const nombre = String((err as { name?: unknown } | null)?.name ?? "Error").slice(0, 60);
    console.error("[galerias] falló el armado de una parte", { codigo: (err as { code?: unknown } | null)?.code ?? nombre, parte: siguiente.n, intento: intentos + 1 });
    if (intentos + 1 >= MAX_INTENTOS_PARTE) {
      await fallar(d, siguiente.n, intentos + 1, "No se pudo armar una de las partes después de varios intentos.", ahora);
    } else {
      // Vuelve a la cola; la próxima corrida la rehace desde cero.
      await prisma.fotofficeGaleriaDescarga.updateMany({
        where: { id: d.id, status: "ARMANDO" },
        data: { status: "PENDIENTE", cursor: json({ n: siguiente.n, uploadId: null, intentos: intentos + 1 } satisfies Cursor), updatedAt: ahora },
      });
    }
    return { fallo: true };
  }
}

type FilaTrabajo = { id: string; workspaceId: string; galeriaId: string; galeriaClienteId: string | null };

async function armarParte(
  d: FilaTrabajo,
  parte: Extract<ParteDescarga, { tipo: "ZIP" }>,
  intentos: number,
  ahora: Date,
  almacen: AlmacenZip,
  deps: DepsDescargas,
): Promise<{ bytes: number; files: number }> {
  const fotos = await prisma.fotofficeGaleriaFoto.findMany({
    where: { workspaceId: d.workspaceId, galeriaId: d.galeriaId, status: "LISTA", id: { in: parte.fileIds } },
    select: { id: true, fileName: true, originalKey: true, createdAt: true },
  });
  const porId = new Map(fotos.map((f) => [f.id, f]));
  // En el orden del plan; lo que se borró de la galería después de pedir la descarga simplemente no entra.
  // Los nombres ya vienen sin repetirse entre TODAS las partes (se calculan al crear el pedido).
  const abiertos: unknown[] = [];
  const archivos: ArchivoParaZip[] = [];
  parte.fileIds.forEach((fid, i) => {
    const f = porId.get(fid);
    if (!f || !f.originalKey) return;
    archivos.push({
      nombre: parte.nombres?.[i] ?? f.fileName,
      fecha: f.createdAt,
      abrir: async () => {
        const flujo = await almacen.leer(f.originalKey);
        abiertos.push(flujo);
        return flujo;
      },
    });
  });

  const uploadId = await almacen.iniciarMultiparte(parte.key, "application/zip");
  // Queda anotado ANTES de subir: si la corrida muere, la siguiente sabe qué subida abortar.
  await prisma.fotofficeGaleriaDescarga.updateMany({
    where: { id: d.id, status: "ARMANDO" },
    data: { cursor: json({ n: parte.n, uploadId, intentos } satisfies Cursor), updatedAt: ahora },
  });
  const reloj = deps.ahora ?? (() => new Date());
  const inicio = Date.now();
  const presupuesto = deps.presupuestoMs ?? PRESUPUESTO_CORRIDA_MS - RESERVA_CIERRE_MS;
  const bloque = deps.bloque ?? BLOQUE_SUBIDA;
  const resultado = { archivos: 0, bytes: 0, omitidos: 0 };
  const etiquetas: { numero: number; etag: string }[] = [];
  let enVuelo: Promise<void> | null = null;
  let ultimoLatido = Date.now();
  try {
    let numero = 0;
    for await (const b of enBloques(zipEnFlujo(archivos, resultado), bloque)) {
      if (Date.now() - inicio > presupuesto) throw new Error("TIEMPO_AGOTADO");
      numero++;
      if (enVuelo) await enVuelo;
      const n = numero;
      const subida = almacen.subirBloque(parte.key, uploadId, n, b).then((etag) => {
        etiquetas.push({ numero: n, etag });
      });
      subida.catch(() => {});
      enVuelo = subida;
      if (Date.now() - ultimoLatido > LATIDO_MS) {
        ultimoLatido = Date.now();
        await prisma.fotofficeGaleriaDescarga.updateMany({ where: { id: d.id, status: "ARMANDO" }, data: { updatedAt: reloj() } });
      }
    }
    if (enVuelo) await enVuelo;
    if (resultado.archivos === 0) {
      // Todos los archivos de la parte ya no existen: no hay nada que entregar.
      await almacen.abortarMultiparte(parte.key, uploadId);
      return { bytes: 0, files: 0 };
    }
    etiquetas.sort((a, b) => a.numero - b.numero);
    await almacen.completarMultiparte(parte.key, uploadId, etiquetas);
    return { bytes: resultado.bytes, files: resultado.archivos };
  } catch (err) {
    try {
      await enVuelo?.catch(() => {});
      await almacen.abortarMultiparte(parte.key, uploadId);
    } catch {
      // Si no se pudo abortar, la próxima corrida lo intenta con el uploadId del cursor.
    }
    throw err;
  } finally {
    // Si se cortó con una lectura de R2 abierta, se cierra el socket ya (no esperar a que la función se congele).
    for (const f of abiertos) (f as { destroy?: () => void } | null)?.destroy?.();
  }
}

async function fallar(d: FilaTrabajo, n: number, intentos: number, motivo: string, ahora: Date): Promise<void> {
  await prisma.fotofficeGaleriaDescarga.updateMany({
    where: { id: d.id, status: "ARMANDO" },
    data: { status: "ERROR", errorReason: motivo, cursor: json({ n, uploadId: null, intentos } satisfies Cursor), updatedAt: ahora },
  });
  await registrarEventoSinFallar({ workspaceId: d.workspaceId, galeriaId: d.galeriaId, galeriaClienteId: d.galeriaClienteId, tipo: "DESCARGA_ERROR", data: { descargaId: d.id, parte: n } });
}

async function terminar(d: FilaTrabajo, partes: ParteDescarga[], ahora: Date, deps: DepsDescargas): Promise<void> {
  const r = await prisma.fotofficeGaleriaDescarga.updateMany({
    where: { id: d.id, status: "ARMANDO" },
    data: {
      status: "LISTA",
      parts: json(partes),
      cursor: Prisma.DbNull,
      // Los 7 días de vida se cuentan desde que queda lista.
      expiresAt: new Date(ahora.getTime() + DIAS_VIGENCIA_DESCARGA * DIA),
      updatedAt: ahora,
    },
  });
  if (r.count === 0) return;
  await registrarEventoSinFallar({ workspaceId: d.workspaceId, galeriaId: d.galeriaId, galeriaClienteId: d.galeriaClienteId, tipo: "DESCARGA_LISTA", data: { descargaId: d.id } });
  const avisar = deps.avisar ?? ((id: string, a: Date) => avisarDescargaLista(id, a, deps));
  try {
    await avisar(d.id, ahora);
  } catch (err) {
    console.error("[galerias] falló el aviso de descarga lista", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
  }
}

/**
 * Descargas LISTA cuyo aviso quedó pendiente (el correo falló por el tope diario o por el proveedor, o la corrida murió
 * con la reserva puesta). Sólo las que quedaron listas hace menos de un día: se mide con `expiresAt` (listaEn + 7 días),
 * que no se mueve, y NO con `updatedAt` (que Prisma refresca en cada escritura).
 */
async function avisarPendientes(ahora: Date, deps: DepsDescargas): Promise<number> {
  const filas = await prisma.fotofficeGaleriaDescarga.findMany({
    where: { status: "LISTA", notifiedAt: null, expiresAt: { gt: new Date(ahora.getTime() + (DIAS_VIGENCIA_DESCARGA - 1) * DIA) } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 10,
    select: { id: true },
  });
  const avisar = deps.avisar ?? ((id: string, a: Date) => avisarDescargaLista(id, a, deps));
  let n = 0;
  for (const f of filas) {
    try {
      const r = await avisar(f.id, ahora);
      if (r !== "YA_AVISADA" && r !== "ESPERA") n++;
    } catch {
      /* se reintenta en la próxima pasada */
    }
  }
  return n;
}

// --- El correo -------------------------------------------------------------------------------------------

type EstadoAviso = { intentos: number; proximo: string | null; reservadaEn: string | null; falloRegistrado: boolean };

/** El estado del aviso vive en `cursor.aviso` mientras la descarga está LISTA (el armado ya no usa el cursor). */
function aAviso(cursor: unknown): EstadoAviso {
  const a = cursor && typeof cursor === "object" ? (cursor as { aviso?: Partial<EstadoAviso> }).aviso : undefined;
  return {
    intentos: typeof a?.intentos === "number" ? a.intentos : 0,
    proximo: typeof a?.proximo === "string" ? a.proximo : null,
    reservadaEn: typeof a?.reservadaEn === "string" ? a.reservadaEn : null,
    falloRegistrado: a?.falloRegistrado === true,
  };
}

/**
 * Avisa que la descarga está lista.
 * - `notifiedAt` se escribe SÓLO cuando el proveedor aceptó el correo (o cuando ya no tiene sentido insistir).
 * - Antes de mandar se «reserva» con una escritura condicional que guarda `reservadaEn` en `cursor.aviso`: es un
 *   arriendo de 10 minutos; si la función muere a mitad, otra corrida lo retoma pasado ese plazo.
 * - Si no salió por el tope diario o por el proveedor se reintenta con espera de 30 minutos o más, hasta 12 intentos
 *   y dentro del día de haber quedado lista; por motivos permanentes (plantilla apagada, sin correo, enlace anulado) no.
 * - Deja a lo sumo UN evento de falla por pedido.
 */
export async function avisarDescargaLista(descargaId: string, ahora: Date, deps: Pick<DepsDescargas, "appOrigin"> & { clave?: string | null } = {}): Promise<ResultadoCorreoGaleria | "YA_AVISADA" | "ESPERA"> {
  const fila = await prisma.fotofficeGaleriaDescarga.findFirst({
    where: { id: descargaId, status: "LISTA", notifiedAt: null },
    select: { workspaceId: true, galeriaId: true, galeriaClienteId: true, requestedEmail: true, expiresAt: true, cursor: true, updatedAt: true },
  });
  if (!fila) return "YA_AVISADA";
  const est = aAviso(fila.cursor);
  const d = { workspaceId: fila.workspaceId, galeriaId: fila.galeriaId, galeriaClienteId: fila.galeriaClienteId };
  if (est.reservadaEn && ahora.getTime() - new Date(est.reservadaEn).getTime() < ARRIENDO_AVISO_MS) return "YA_AVISADA";
  if (est.proximo && ahora.getTime() < new Date(est.proximo).getTime()) return "ESPERA";

  const cerrar = async (resultado: ResultadoCorreoGaleria) => {
    await prisma.fotofficeGaleriaDescarga.updateMany({ where: { id: descargaId, status: "LISTA" }, data: { notifiedAt: ahora, cursor: Prisma.DbNull, updatedAt: ahora } });
    if (!est.falloRegistrado) {
      await registrarEventoSinFallar({ ...d, tipo: "DESCARGA_CORREO_NO_ENVIADO", data: { motivo: resultado } });
    }
  };
  const listaEn = fila.expiresAt.getTime() - DIAS_VIGENCIA_DESCARGA * DIA;
  if (est.intentos >= MAX_INTENTOS_AVISO || (est.intentos > 0 && ahora.getTime() - listaEn > DIA)) {
    await cerrar("NO_ENVIADO");
    return "NO_ENVIADO";
  }

  // Reserva (arriendo). `updatedAt` hace de versión: si otra corrida escribió en el medio, no se gana.
  const intentos = est.intentos + 1;
  const reservada = await prisma.fotofficeGaleriaDescarga.updateMany({
    where: { id: descargaId, status: "LISTA", notifiedAt: null, updatedAt: fila.updatedAt },
    data: { cursor: json({ aviso: { ...est, intentos, reservadaEn: ahora.toISOString() } }), updatedAt: ahora },
  });
  if (reservada.count === 0) return "YA_AVISADA";

  let resultado: ResultadoCorreoGaleria = "ERROR";
  let terminal = false;
  try {
    const galeria = await prisma.fotofficeGaleria.findFirst({ where: { id: fila.galeriaId, workspaceId: fila.workspaceId }, select: { number: true, name: true } });
    if (!galeria) terminal = true;
    else {
      const cliente = fila.galeriaClienteId
        ? await prisma.fotofficeGaleriaCliente.findFirst({
            where: { id: fila.galeriaClienteId, workspaceId: fila.workspaceId, galeriaId: fila.galeriaId },
            select: { id: true, name: true, email: true, tokenHash: true, tokenIssuedAt: true, revokedAt: true },
          })
        : null;
      const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
      let enlace: string | null = null;
      let nombre = "";
      let para = fila.requestedEmail ?? "";
      if (fila.galeriaClienteId && cliente) {
        nombre = cliente.name;
        if (!para) para = cliente.email ?? "";
        const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
        // El enlace personal sólo se arma si el cliente sigue vigente y el token coincide con el guardado.
        if (clave && !cliente.revokedAt) {
          const token = tokenDeGaleriaCliente(cliente.id, cliente.tokenIssuedAt, clave);
          if (hashDeToken(token) === cliente.tokenHash) {
            const sitio = await sitioDelWorkspace(fila.workspaceId);
            if (sitio?.customDomain) enlace = `https://${sitio.customDomain}/galeria/${encodeURIComponent(token)}/descargas`;
            else if (sitio?.slug && origen) enlace = `${origen}/w/${encodeURIComponent(sitio.slug)}/galeria/${encodeURIComponent(token)}/descargas`;
          }
        }
      } else if (origen) {
        enlace = `${origen}/galerias/${encodeURIComponent(fila.galeriaId)}?tab=descargas`;
      }
      if (!enlace) terminal = true;
      else {
        resultado = await enviarCorreoGaleria({
          workspaceId: fila.workspaceId, clave: "GALERIA_DESCARGA_LISTA", galeriaId: fila.galeriaId, para, nombre,
          numero: galeria.number, nombreGaleria: galeria.name, enlace, vence: fechaCorta(fila.expiresAt),
        });
        if (resultado === "APAGADA" || resultado === "SIN_CORREO" || resultado === "PLANTILLA_CON_ERRORES") terminal = true;
      }
    }
  } catch (err) {
    // Una falla transitoria (base caída) se trata como correo no enviado: se reintenta.
    console.error("[galerias] falló el correo de descarga lista", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
    resultado = "ERROR";
  }

  if (resultado === "ENVIADO") {
    await prisma.fotofficeGaleriaDescarga.updateMany({ where: { id: descargaId, status: "LISTA" }, data: { notifiedAt: ahora, cursor: Prisma.DbNull, updatedAt: ahora } });
    await registrarEventoSinFallar({ ...d, tipo: "DESCARGA_CORREO_ENVIADO" });
    return resultado;
  }
  if (terminal || intentos >= MAX_INTENTOS_AVISO) {
    await cerrar(resultado);
    return resultado;
  }
  // Reintentable: se suelta el arriendo y se espera 30 minutos o más antes del próximo intento.
  await prisma.fotofficeGaleriaDescarga.updateMany({
    where: { id: descargaId, status: "LISTA", notifiedAt: null },
    data: { cursor: json({ aviso: { intentos, proximo: new Date(ahora.getTime() + ESPERA_AVISO_MS * Math.min(intentos, 4)).toISOString(), reservadaEn: null, falloRegistrado: true } }), updatedAt: ahora },
  });
  if (!est.falloRegistrado) await registrarEventoSinFallar({ ...d, tipo: "DESCARGA_CORREO_NO_ENVIADO", data: { motivo: resultado } });
  return resultado;
}
