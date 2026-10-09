import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { fechaDeBase, planesDe } from "@/lib/pedidos/plan";
import { validarItems } from "@/lib/presupuestos/constantes";
import { MENSAJES_CONTRATO as M, puedeGestionarContratos, type CtxContratos } from "./acceso";
import { leerAjustesContratos } from "./ajustes";
import { MAX_CUERPO_CONTRATO, MAX_MOTIVO, MAX_NOMBRE_CONTRATO } from "./constantes";
import { resolverContratantes } from "./contratantes";
import { registrarEvento } from "./eventos";
import { Corte, bloquearContrato } from "./versiones";
import { completarContrato, contextoContrato, type ContextoContratoEntrada, type ItemParaContrato } from "./variables";

/**
 * Contratos (etapa 5): generar desde un pedido, editar el borrador, actualizar los datos, anular y marcar
 * firmado en papel. Enviar y reenviar están en `envio.ts`. Todas exigen "Gestionar" en Contratos y trabajan
 * siempre dentro del workspace del contexto; un id de otro workspace es "no existe".
 *
 * NÚMERO: la columna `number` es obligatoria y única, así que el contrato recibe su número (secuencia
 * CONTRATO) al generarse, en la misma transacción que lo crea: así el borrador ya puede mostrar
 * `[contrato_numero]`. Si la generación falla, la transacción se deshace y el número no se consume.
 */

export type ResultadoContrato = { ok: true } | { ok: false; error: string };
export type ResultadoGenerar = { ok: true; id: string; numero: string; vacias: string[] } | { ok: false; error: string };

const no = (error: string) => ({ ok: false as const, error });

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, e: unknown): void {
  // Sólo el código: el mensaje de Prisma puede repetir datos de las personas.
  console.error(`[contratos] ${donde} falló`, { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
}

function numeroONulo(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Lo que el contrato usa del pedido, leído del workspace. null si no existe. */
async function datosDelPedido(workspaceId: string, pedidoId: string) {
  const p = await prisma.fotofficePedido.findFirst({
    where: { id: pedidoId, workspaceId },
    select: { id: true, number: true, status: true, items: true, totals: true, totalArs: true, eventDate: true, eventLabel: true },
  });
  if (!p) return null;
  const plan = (await planesDe(workspaceId, [p.id])).get(p.id);
  const renglones = ((p.totals as { renglones?: Record<string, { neto?: unknown }> } | null)?.renglones ?? {}) as Record<string, { neto?: unknown }>;
  // Un ítem que no valida NO se descarta en silencio: el contrato saldría sin parte de lo vendido.
  const validos = validarItems(p.items);
  if (!validos.ok) return "ITEMS_INVALIDOS" as const;
  const items: ItemParaContrato[] = validos.valor.map((i) => ({
    nombre: i.nombre,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    total: numeroONulo(renglones[i.id]?.neto) ?? i.cantidad * i.precioUnitario,
    opcional: i.opcional,
  }));
  return {
    pedido: p,
    items,
    cuotas: (plan?.cuotas ?? []).map((c) => ({ position: c.position, dueDate: c.dueDate, amountArs: c.amountArs })),
    totalArs: Number(p.totalArs.toString()),
  };
}

type BaseDelTexto = {
  entrada: Omit<ContextoContratoEntrada, "numero" | "hoy">;
  clientId: string;
  nombrePedido: string;
};

/** Lee (fuera de toda transacción) lo que el texto del contrato necesita del pedido: contratantes, ítems, cuotas, empresa y evento. */
async function leerBaseDelTexto(workspaceId: string, pedidoId: string): Promise<BaseDelTexto | { error: string } | null> {
  const [d, contratantes, ajustes] = await Promise.all([
    datosDelPedido(workspaceId, pedidoId),
    resolverContratantes(workspaceId, pedidoId),
    leerAjustesContratos(workspaceId),
  ]);
  if (d === "ITEMS_INVALIDOS") return { error: M.itemsInvalidos };
  if (!d || !contratantes || contratantes.length === 0) return null;
  return {
    entrada: {
      pedido: { numero: d.pedido.number, totalArs: d.totalArs },
      items: d.items,
      cuotas: d.cuotas,
      contratantes: contratantes.map((c) => c.datos),
      empresa: { nombre: ajustes.companyName, cuit: ajustes.companyTaxId, domicilio: ajustes.companyAddress },
      evento: { nombre: d.pedido.eventLabel, fecha: d.pedido.eventDate ? fechaDeBase(d.pedido.eventDate) : null },
    },
    clientId: contratantes[0]!.clientId,
    nombrePedido: d.pedido.number,
  };
}

/** Puro: el texto completo del contrato desde el cuerpo de una plantilla y la base leída. `numero` es el del contrato. */
function armarTexto(
  cuerpoPlantilla: string,
  base: BaseDelTexto,
  numero: string,
  hoy: Date,
): { ok: true; texto: string; vacias: string[] } | { ok: false; error: string } {
  const r = completarContrato(cuerpoPlantilla, contextoContrato({ ...base.entrada, numero, hoy }));
  if (!r.ok) {
    const lista = r.desconocidas.length ? ` ${r.desconocidas.map((v) => `[${v}]`).join(", ")}` : "";
    return no(`${M.plantillaConVariables}${lista}`);
  }
  if (r.texto.length > MAX_CUERPO_CONTRATO) return no(M.textoLargo);
  return { ok: true, texto: r.texto, vacias: r.vacias };
}

function nombreDelContrato(plantilla: string, pedido: string): string {
  return `${plantilla} · Pedido ${pedido}`.slice(0, MAX_NOMBRE_CONTRATO);
}

/**
 * Genera un contrato en BORRADOR desde un pedido y una plantilla activa del workspace. El texto sale de
 * la plantilla con los datos del pedido ya completados (contratantes, ítems, cuotas, evento, empresa).
 * `vacias` son las variables que quedaron sin dato, para avisar a quien lo revisa.
 */
export async function generarContrato(ctx: CtxContratos, pedidoId: unknown, templateId: unknown, ahora: Date = new Date()): Promise<ResultadoGenerar> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(pedidoId) || !idValido(templateId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true } });
  if (!pedido) return no(M.pedido);
  if (pedido.status === "CANCELADO") return no(M.pedidoCancelado);
  const plantilla = await prisma.fotofficeContratoPlantilla.findFirst({
    where: { id: templateId, workspaceId, isActive: true },
    select: { id: true, name: true, body: true },
  });
  if (!plantilla) return no(M.plantillaNoExiste);

  const base = await leerBaseDelTexto(workspaceId, pedido.id);
  if (!base) return no(M.pedido);
  if ("error" in base) return no(base.error);
  // Se prueba con un número de muestra antes de gastar uno de verdad.
  const prueba = armarTexto(plantilla.body, base, "C-0000", ahora);
  if (!prueba.ok) return prueba;

  try {
    return await prisma.$transaction(async (tx) => {
      const id = randomUUID();
      const numero = await asignarNumero(tx, { workspaceId, key: "CONTRATO", entityType: "CONTRATO", entityId: id, fecha: ahora });
      const t = armarTexto(plantilla.body, base, numero.display, ahora);
      if (!t.ok) throw new Corte(t.error);
      await tx.fotofficeContrato.create({
        data: {
          id, workspaceId, pedidoId: pedido.id, clientId: base.clientId, templateId: plantilla.id, number: numero.display,
          name: nombreDelContrato(plantilla.name, base.nombrePedido), status: "BORRADOR", bodyText: t.texto,
          ownerUserId: ctx.userId, createdByUserId: ctx.userId,
        },
        select: { id: true },
      });
      await registrarEvento(tx, { workspaceId, contratoId: id, tipo: "CREADO", actorUserId: ctx.userId });
      return { ok: true as const, id, numero: numero.display, vacias: t.vacias };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    falla("generar", e);
    return no(M.guardar);
  }
}

/** Edita el texto (y opcionalmente el nombre) de un BORRADOR. Un contrato ya enviado se corrige, no se edita. */
export async function editarBorrador(ctx: CtxContratos, contratoId: unknown, datos: unknown): Promise<ResultadoContrato> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(contratoId) || !datos || typeof datos !== "object") return no(M.datosInvalidos);
  const d = datos as Record<string, unknown>;
  if (typeof d.texto !== "string") return no(M.textoVacio);
  const texto = d.texto.replace(/\r\n?/g, "\n").trim();
  if (!texto) return no(M.textoVacio);
  if (texto.length > MAX_CUERPO_CONTRATO) return no(M.textoLargo);
  let nombre: string | undefined;
  if (d.nombre !== undefined) {
    if (typeof d.nombre !== "string") return no(M.nombreContrato);
    nombre = d.nombre.replace(/\s+/g, " ").trim();
    if (!nombre || nombre.length > MAX_NOMBRE_CONTRATO) return no(M.nombreContrato);
  }
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const c = await tx.fotofficeContrato.findFirst({ where: { id: contratoId, workspaceId }, select: { id: true, status: true } });
      if (!c) throw new Corte(M.contratoNoExiste);
      // Condicional: si otra persona lo envió mientras tanto, no se pisa nada.
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: "BORRADOR" },
        data: { bodyText: texto, ...(nombre ? { name: nombre } : {}) },
      });
      if (r.count !== 1) throw new Corte(M.soloBorrador);
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "EDITADO", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    falla("editar", e);
    return no(M.guardar);
  }
}

/**
 * "Actualizar datos": vuelve a armar el texto desde la plantilla con los datos de hoy del pedido, los
 * contratantes y la empresa. PISA lo que se haya editado a mano, así que exige `confirmar: true`.
 * Sólo un BORRADOR.
 */
export async function actualizarDatos(ctx: CtxContratos, contratoId: unknown, confirmar: unknown, ahora: Date = new Date()): Promise<ResultadoGenerar> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(contratoId)) return no(M.datosInvalidos);
  if (confirmar !== true) return no(M.confirmarActualizar);
  const { workspaceId } = ctx;
  const c = await prisma.fotofficeContrato.findFirst({
    where: { id: contratoId, workspaceId },
    select: { id: true, status: true, pedidoId: true, templateId: true, number: true },
  });
  if (!c) return no(M.contratoNoExiste);
  if (c.status !== "BORRADOR") return no(M.soloBorrador);
  const plantilla = c.templateId
    ? await prisma.fotofficeContratoPlantilla.findFirst({ where: { id: c.templateId, workspaceId }, select: { body: true } })
    : null;
  if (!plantilla) return no(M.sinPlantilla);
  const base = await leerBaseDelTexto(workspaceId, c.pedidoId);
  if (!base) return no(M.pedido);
  if ("error" in base) return no(base.error);
  const t = armarTexto(plantilla.body, base, c.number, ahora);
  if (!t.ok) return t;
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: "BORRADOR" },
        data: { bodyText: t.texto, clientId: base.clientId },
      });
      if (r.count !== 1) throw new Corte(M.soloBorrador);
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "EDITADO", actorUserId: ctx.userId, data: { actualizado: true } });
      return { ok: true as const, id: contratoId, numero: c.number, vacias: t.vacias };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    falla("actualizar datos", e);
    return no(M.guardar);
  }
}

/**
 * Anula un contrato con motivo. Se puede en cualquier estado menos FIRMADO (un contrato firmado no se
 * anula: es prueba) y ANULADO. El enlace de los firmantes deja de servir (la página mira el estado).
 */
export async function anular(ctx: CtxContratos, contratoId: unknown, motivo: unknown, ahora: Date = new Date()): Promise<ResultadoContrato> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(contratoId)) return no(M.datosInvalidos);
  const razon = typeof motivo === "string" ? motivo.replace(/\s+/g, " ").trim() : "";
  if (!razon || razon.length > MAX_MOTIVO) return no(M.motivoAnular);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const c = await tx.fotofficeContrato.findFirst({ where: { id: contratoId, workspaceId }, select: { id: true, status: true } });
      if (!c) throw new Corte(M.contratoNoExiste);
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: { in: ["BORRADOR", "ENVIADO", "FIRMADO_PARCIAL", "RECHAZADO"] } },
        data: { status: "ANULADO", voidedAt: ahora, voidReason: razon },
      });
      if (r.count !== 1) throw new Corte(M.noSeAnula);
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "ANULADO", actorUserId: ctx.userId, data: { desde: c.status } });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    falla("anular", e);
    return no(M.guardar);
  }
}

/**
 * Marca el contrato como firmado en papel, con el escaneo como respaldo: un adjunto LISTO (subido del todo,
 * no borrado) de la ficha del contacto del contrato, en el mismo workspace. Pasa a FIRMADO. Si había una
 * versión enviada se revoca: los enlaces electrónicos dejan de servir. Sólo desde BORRADOR, ENVIADO o
 * FIRMADO_PARCIAL.
 */
export async function marcarFirmadoEnPapel(ctx: CtxContratos, contratoId: unknown, adjuntoId: unknown, ahora: Date = new Date()): Promise<ResultadoContrato> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (!idValido(contratoId) || !idValido(adjuntoId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearContrato(tx, contratoId);
      const c = await tx.fotofficeContrato.findFirst({
        where: { id: contratoId, workspaceId },
        select: { id: true, status: true, clientId: true, currentVersionId: true },
      });
      if (!c) throw new Corte(M.contratoNoExiste);
      const adjunto = await tx.fotofficeAttachment.findFirst({
        where: { id: adjuntoId, workspaceId, clientId: c.clientId, status: "LISTO", deletedAt: null },
        select: { id: true },
      });
      if (!adjunto) throw new Corte(M.adjuntoPapel);
      const r = await tx.fotofficeContrato.updateMany({
        where: { id: contratoId, workspaceId, status: { in: ["BORRADOR", "ENVIADO", "FIRMADO_PARCIAL"] } },
        data: { status: "FIRMADO", signedAt: ahora, manualSignedAt: ahora, manualAttachmentId: adjunto.id },
      });
      if (r.count !== 1) throw new Corte(M.noSePasaAPapel);
      if (c.currentVersionId) {
        await tx.fotofficeContratoVersion.updateMany({ where: { id: c.currentVersionId, workspaceId, revokedAt: null }, data: { revokedAt: ahora } });
      }
      await registrarEvento(tx, { workspaceId, contratoId, tipo: "FIRMADO_EN_PAPEL", actorUserId: ctx.userId, data: { desde: c.status } });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return no(e.mensaje);
    falla("firmado en papel", e);
    return no(M.guardar);
  }
}
