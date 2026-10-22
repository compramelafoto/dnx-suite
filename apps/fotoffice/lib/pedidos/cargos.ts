import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { MENSAJES_PEDIDO } from "./acceso";
import { esEstadoPedido, OPCIONES_TRANSACCION_PEDIDO } from "./constantes";
import { decimalArsToMinor } from "@/lib/membership/money";
import {
  ajustarTotales, armarItemCargo, hayLugarParaOtroItem, itemDeCargo, itemsConCargo, itemsConPrecio, itemsSinCargo, precioDelRenglonDeCargo, totalesConCargo,
} from "./cargos-puro";
import { bloquearPedido, fechaParaBase, pesosDeBase, pesosParaBase } from "./plan";
import { aCentavos, tieneHastaDosDecimales } from "./plan-cuotas";

/**
 * Cargos extra de un pedido ya tomado (spec 2026-10-22, E6): un renglón más, el total más alto y
 * una cuota nueva al final que vence hoy (día de Argentina). Genérico: lo usa Digitalización
 * (descargas extra, extensión y envío de cassettes) y sirve para cualquier otro módulo.
 *
 * - Todo con el candado del pedido (`bloquearPedido`), el mismo de cobrar, editar el plan y
 *   cambiar el estado: el total y las cuotas nunca quedan descuadrados (la suma de las cuotas
 *   sigue siendo el total, que es lo que exige `editarPlan`).
 * - Un pedido CANCELADO no acepta cargos. Uno COMPLETADO sí y sigue COMPLETADO: el estado del
 *   pedido es del trabajo y se pasa a mano (`puedePasarPedido` no deja volver de COMPLETADO); el
 *   saldo nuevo se ve y se cobra igual que el de cualquier pedido completado.
 * - Quitar un cargo (`quitarCargoDelPedido`) o cambiar su importe sólo se puede mientras siga
 *   intacto: su cuota sin ninguna imputación (ni de cobros anulados) y con el mismo importe que su
 *   renglón. Nunca baja `totalArs` sin bajar `totals`, ni toca deuda que no sea del cargo.
 *
 * Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type DatosCargo = {
  workspaceId: string;
  pedidoId: string;
  /** Lo que ve el cliente en el renglón ("Descarga extra · Cassette 1"). */
  concepto: string;
  /** Pesos, mayor que cero y con hasta dos decimales. */
  montoArs: number;
  /** Quién lo agregó, para el rastro en el JSON ("digitalizacion:EXTENSION"). */
  origen: string;
  ahora?: Date;
};

export type ResultadoCargo = { ok: true; cuotaId: string; itemId: string } | { ok: false; error: string };

export const MENSAJES_CARGO = {
  monto: "El importe del cargo no es válido.",
  concepto: "El cargo necesita un concepto.",
  cancelado: MENSAJES_PEDIDO.cancelado,
  noExiste: MENSAJES_PEDIDO.noExiste,
  muchosItems: "El pedido ya tiene demasiados renglones para sumar otro cargo.",
  conCobros: "Ese cargo ya tiene un pago registrado o iniciado: no se puede cambiar.",
  planEditado: "El plan de pagos se editó a mano: revisá ese cargo en el pedido.",
  sinRenglon: "Ese cargo ya no está en los renglones del pedido.",
  fallo: MENSAJES_PEDIDO.fallo,
} as const;

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

const montoValido = (m: unknown): m is number =>
  typeof m === "number" && Number.isFinite(m) && tieneHastaDosDecimales(m) && aCentavos(m) > 0 && m <= 999_999_999.99;

/**
 * Suma el cargo DENTRO de la transacción del llamador (que puede escribir lo suyo en la misma, como
 * `DigitalizacionCargo`). Toma el candado del pedido (es reentrante dentro de la misma transacción).
 * Corta lanzando: el llamador deshace todo.
 */
export async function agregarCargoEnTransaccion(tx: Tx, d: DatosCargo): Promise<{ cuotaId: string; itemId: string }> {
  if (!montoValido(d.montoArs)) throw new Corte(MENSAJES_CARGO.monto);
  if (typeof d.concepto !== "string" || d.concepto.trim() === "") throw new Corte(MENSAJES_CARGO.concepto);
  const ahora = d.ahora ?? new Date();
  await bloquearPedido(tx, d.pedidoId);
  const p = await tx.fotofficePedido.findFirst({
    where: { id: d.pedidoId, workspaceId: d.workspaceId },
    select: { id: true, status: true, items: true, totals: true, totalArs: true },
  });
  if (!p || !esEstadoPedido(p.status)) throw new Corte(MENSAJES_CARGO.noExiste);
  if (p.status === "CANCELADO") throw new Corte(MENSAJES_CARGO.cancelado);
  if (!hayLugarParaOtroItem(p.items)) throw new Corte(MENSAJES_CARGO.muchosItems);

  const ultima = await tx.fotofficePedidoCuota.findFirst({
    where: { workspaceId: d.workspaceId, pedidoId: p.id },
    orderBy: [{ position: "desc" }],
    select: { position: true },
  });
  const cuotaId = randomUUID();
  const item = armarItemCargo({ cuotaId, concepto: d.concepto, montoArs: d.montoArs, origen: d.origen });
  await tx.fotofficePedidoCuota.create({
    data: {
      id: cuotaId,
      workspaceId: d.workspaceId,
      pedidoId: p.id,
      position: (ultima?.position ?? 0) + 1,
      dueDate: fechaParaBase(diaEnBuenosAires(ahora)),
      amountArs: pesosParaBase(d.montoArs),
      suggestedMethod: null,
    },
    select: { id: true },
  });
  await tx.fotofficePedido.update({
    where: { id: p.id },
    data: {
      items: itemsConCargo(p.items, item) as unknown as Prisma.InputJsonValue,
      totals: totalesConCargo(p.totals, item.id, d.montoArs, 1) as Prisma.InputJsonValue,
      totalArs: pesosParaBase(pesosDeBase(p.totalArs) + d.montoArs),
    },
    select: { id: true },
  });
  return { cuotaId, itemId: item.id };
}

/** `agregarCargoEnTransaccion` en su propia transacción. No lanza. */
export async function agregarCargoAlPedido(d: DatosCargo): Promise<ResultadoCargo> {
  try {
    const r = await prisma.$transaction((tx) => agregarCargoEnTransaccion(tx, d), OPCIONES_TRANSACCION_PEDIDO);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("agregarCargoAlPedido", e);
    return { ok: false, error: MENSAJES_CARGO.fallo };
  }
}

const esperaAbierta = async (tx: Tx, workspaceId: string, cuotaId: string) =>
  (await tx.fotofficeEsperaPago.count({ where: { workspaceId, cuotaId, estado: "ESPERANDO" } })) > 0;

export type MotivoCargoTrabado = "CON_COBROS" | "PLAN_EDITADO" | "NO_EXISTE";
export type ResultadoTocarCargo = { ok: true } | { ok: false; motivo: MotivoCargoTrabado; error: string };

/**
 * ¿El cargo sigue tal como se sumó? La cuota existe, no tiene NINGUNA imputación (ni de cobros
 * anulados) ni una transferencia esperada abierta, vale exactamente el monto del cargo, su renglón `cargo-<cuotaId>` está en los ítems
 * con ese precio y el total lo contiene. Si algo no cuadra, alguien editó el plan a mano: tocar el
 * cargo podría borrar deuda que no es suya, así que no se toca.
 */
async function cargoIntacto(
  tx: Tx,
  d: { workspaceId: string; pedidoId: string; cuotaId: string; montoArs: number },
): Promise<{ ok: true; p: { id: string; items: unknown; totals: unknown; totalArs: { toString(): string } }; position: number } | { ok: false; motivo: MotivoCargoTrabado; error: string }> {
  await bloquearPedido(tx, d.pedidoId);
  const p = await tx.fotofficePedido.findFirst({
    where: { id: d.pedidoId, workspaceId: d.workspaceId },
    select: { id: true, items: true, totals: true, totalArs: true },
  });
  if (!p) return { ok: false, motivo: "NO_EXISTE", error: MENSAJES_CARGO.noExiste };
  const cuota = await tx.fotofficePedidoCuota.findFirst({
    where: { id: d.cuotaId, workspaceId: d.workspaceId, pedidoId: p.id },
    select: { id: true, position: true, amountArs: true },
  });
  if (!cuota) return { ok: false, motivo: "PLAN_EDITADO", error: MENSAJES_CARGO.planEditado };
  const imputaciones = await tx.fotofficeCobroImputacion.count({ where: { workspaceId: d.workspaceId, cuotaId: cuota.id } });
  if (imputaciones > 0) return { ok: false, motivo: "CON_COBROS", error: MENSAJES_CARGO.conCobros };
  // Una transferencia anunciada para esta cuota: el cliente ya tiene el importe para transferir.
  if (await esperaAbierta(tx, d.workspaceId, cuota.id)) return { ok: false, motivo: "CON_COBROS", error: MENSAJES_CARGO.conCobros };
  const monto = aCentavos(d.montoArs);
  const precio = precioDelRenglonDeCargo(p.items, cuota.id);
  if (decimalArsToMinor(cuota.amountArs) !== monto || precio === null || aCentavos(precio) !== monto || decimalArsToMinor(p.totalArs) < monto) {
    return { ok: false, motivo: "PLAN_EDITADO", error: MENSAJES_CARGO.planEditado };
  }
  return { ok: true, p, position: cuota.position };
}

/**
 * Deshace un cargo DENTRO de la transacción del llamador: saca el renglón, baja el total y los
 * `totals` en lo mismo y borra su cuota (las de después suben un lugar). Sólo si el cargo sigue
 * intacto (`cargoIntacto`); si no, no toca nada y devuelve por qué (no lanza: el llamador decide).
 */
export async function quitarCargoEnTransaccion(
  tx: Tx,
  d: { workspaceId: string; pedidoId: string; cuotaId: string; montoArs: number },
): Promise<ResultadoTocarCargo> {
  const v = await cargoIntacto(tx, d);
  if (!v.ok) return v;
  const itemId = itemDeCargo(d.cuotaId);
  const items = itemsSinCargo(v.p.items, itemId);
  if (!items) return { ok: false, motivo: "PLAN_EDITADO", error: MENSAJES_CARGO.planEditado };
  await tx.fotofficePedidoCuota.deleteMany({ where: { id: d.cuotaId, workspaceId: d.workspaceId } });
  const siguientes = await tx.fotofficePedidoCuota.findMany({
    where: { workspaceId: d.workspaceId, pedidoId: v.p.id, position: { gt: v.position } },
    orderBy: [{ position: "asc" }],
    select: { id: true, position: true },
  });
  for (const c of siguientes) {
    await tx.fotofficePedidoCuota.update({ where: { id: c.id }, data: { position: c.position - 1 }, select: { id: true } });
  }
  await tx.fotofficePedido.update({
    where: { id: v.p.id },
    data: {
      items: items as unknown as Prisma.InputJsonValue,
      totals: totalesConCargo(v.p.totals, itemId, d.montoArs, -1) as Prisma.InputJsonValue,
      totalArs: pesosParaBase(pesosDeBase(v.p.totalArs) - d.montoArs),
    },
    select: { id: true },
  });
  return { ok: true };
}

/**
 * Cambia el importe de un cargo EN EL LUGAR (la misma cuota, el mismo renglón): cuota, renglón,
 * `totals` y `totalArs` juntos. Así un pago ya abierto (un checkout de Mercado Pago) sigue apuntando
 * a una cuota que existe. Mismas condiciones que quitar (`cargoIntacto`).
 */
export async function cambiarMontoDelCargoEnTransaccion(
  tx: Tx,
  d: { workspaceId: string; pedidoId: string; cuotaId: string; montoArs: number; montoNuevoArs: number },
): Promise<ResultadoTocarCargo> {
  if (!montoValido(d.montoNuevoArs)) throw new Corte(MENSAJES_CARGO.monto);
  const v = await cargoIntacto(tx, d);
  if (!v.ok) return v;
  const itemId = itemDeCargo(d.cuotaId);
  const items = itemsConPrecio(v.p.items, itemId, d.montoNuevoArs);
  if (!items) return { ok: false, motivo: "PLAN_EDITADO", error: MENSAJES_CARGO.planEditado };
  const delta = d.montoNuevoArs - d.montoArs;
  await tx.fotofficePedidoCuota.update({ where: { id: d.cuotaId }, data: { amountArs: pesosParaBase(d.montoNuevoArs) }, select: { id: true } });
  await tx.fotofficePedido.update({
    where: { id: v.p.id },
    data: {
      items: items as unknown as Prisma.InputJsonValue,
      totals: ajustarTotales(v.p.totals, itemId, d.montoNuevoArs, delta) as Prisma.InputJsonValue,
      totalArs: pesosParaBase(pesosDeBase(v.p.totalArs) + delta),
    },
    select: { id: true },
  });
  return { ok: true };
}

/**
 * `quitarCargoEnTransaccion` en su propia transacción. No lanza. Si el cargo no está intacto por
 * un plan editado a mano, deja una tarea en el pedido para que alguien lo revise.
 */
export async function quitarCargoDelPedido(d: { workspaceId: string; pedidoId: string; cuotaId: string; montoArs: number; concepto?: string }): Promise<ResultadoTocarCargo | { ok: false; motivo: "FALLO"; error: string }> {
  try {
    const r = await prisma.$transaction((tx) => quitarCargoEnTransaccion(tx, d), OPCIONES_TRANSACCION_PEDIDO);
    if (!r.ok && r.motivo === "PLAN_EDITADO") await avisarCargoParaRevisar(d.workspaceId, d.pedidoId, d.concepto ?? "un cargo extra");
    return r;
  } catch (e) {
    falla("quitarCargoDelPedido", e);
    return { ok: false, motivo: "FALLO", error: MENSAJES_CARGO.fallo };
  }
}

/** El título de la tarea "a revisar" de un cargo (uno por concepto). */
export function tituloDeRevision(concepto: string): string {
  return `Revisá el cargo «${concepto.trim().slice(0, 120)}»: el plan se editó a mano y el sistema no lo tocó.`;
}

/** ¿Ya hay una tarea "a revisar" sin hacer para ese cargo? */
export async function hayRevisionAbierta(workspaceId: string, pedidoId: string, concepto: string): Promise<boolean> {
  const t = await prisma.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId, title: tituloDeRevision(concepto), doneAt: null }, select: { id: true } });
  return t !== null;
}

/**
 * Deja en el checklist del pedido la tarea «Revisá el cargo …: el plan se editó a mano» (una sola
 * vez por concepto: si ya está sin hacer, no la repite). Devuelve si la creó (así quien llama deja
 * su nota sólo la primera vez). Nunca lanza.
 */
export async function avisarCargoParaRevisar(workspaceId: string, pedidoId: string, concepto: string): Promise<boolean> {
  const title = tituloDeRevision(concepto);
  try {
    return await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, pedidoId);
      const ya = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId, title, doneAt: null }, select: { id: true } });
      if (ya) return false;
      const ultima = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId }, orderBy: [{ position: "desc" }], select: { position: true } });
      await tx.fotofficePedidoTarea.create({ data: { workspaceId, pedidoId, position: (ultima?.position ?? 0) + 1, title }, select: { id: true } });
      return true;
    }, OPCIONES_TRANSACCION_PEDIDO);
  } catch (e) {
    falla("avisarCargoParaRevisar", e);
    return false;
  }
}

export type ResultadoQuitarAMano = { ok: true; montoArs: number; planCuadra: boolean } | { ok: false; error: string };

/**
 * "Quitar del pedido a mano" (la salida para un cargo "a revisar", lo decide una persona): saca el
 * renglón `cargo-<cuotaId>` y su precio del total y de los `totals`, con el candado del pedido,
 * aunque la cuota ya no exista. Si la cuota existe, no puede tener imputaciones (ni de cobros
 * anulados) ni una transferencia esperada abierta; se le descuenta el precio (y se borra si queda
 * en cero o menos). Si el plan no vuelve a sumar el total (la plata del cargo se había repartido en
 * otras cuotas), `planCuadra` es false: la persona termina de ajustarlo con "Editar plan".
 */
export async function quitarCargoAManoEnTransaccion(tx: Tx, d: { workspaceId: string; pedidoId: string; cuotaId: string }): Promise<ResultadoQuitarAMano> {
  await bloquearPedido(tx, d.pedidoId);
  const p = await tx.fotofficePedido.findFirst({
    where: { id: d.pedidoId, workspaceId: d.workspaceId },
    select: { id: true, items: true, totals: true, totalArs: true },
  });
  if (!p) return { ok: false, error: MENSAJES_CARGO.noExiste };
  const precio = precioDelRenglonDeCargo(p.items, d.cuotaId);
  const items = itemsSinCargo(p.items, itemDeCargo(d.cuotaId));
  if (precio === null || !items) return { ok: false, error: MENSAJES_CARGO.sinRenglon };
  if (decimalArsToMinor(p.totalArs) < aCentavos(precio)) return { ok: false, error: MENSAJES_CARGO.planEditado };
  const cuota = await tx.fotofficePedidoCuota.findFirst({
    where: { id: d.cuotaId, workspaceId: d.workspaceId, pedidoId: p.id },
    select: { id: true, position: true, amountArs: true },
  });
  if (cuota) {
    const imputaciones = await tx.fotofficeCobroImputacion.count({ where: { workspaceId: d.workspaceId, cuotaId: cuota.id } });
    if (imputaciones > 0 || (await esperaAbierta(tx, d.workspaceId, cuota.id))) return { ok: false, error: MENSAJES_CARGO.conCobros };
    const resto = decimalArsToMinor(cuota.amountArs) - aCentavos(precio);
    if (resto > 0) {
      await tx.fotofficePedidoCuota.update({ where: { id: cuota.id }, data: { amountArs: pesosParaBase(resto / 100) }, select: { id: true } });
    } else {
      await tx.fotofficePedidoCuota.deleteMany({ where: { id: cuota.id, workspaceId: d.workspaceId } });
      const siguientes = await tx.fotofficePedidoCuota.findMany({
        where: { workspaceId: d.workspaceId, pedidoId: p.id, position: { gt: cuota.position } },
        orderBy: [{ position: "asc" }],
        select: { id: true, position: true },
      });
      for (const c of siguientes) await tx.fotofficePedidoCuota.update({ where: { id: c.id }, data: { position: c.position - 1 }, select: { id: true } });
    }
  }
  const totalNuevo = pesosDeBase(p.totalArs) - precio;
  await tx.fotofficePedido.update({
    where: { id: p.id },
    data: {
      items: items as unknown as Prisma.InputJsonValue,
      totals: totalesConCargo(p.totals, itemDeCargo(d.cuotaId), precio, -1) as Prisma.InputJsonValue,
      totalArs: pesosParaBase(totalNuevo),
    },
    select: { id: true },
  });
  const cuotas = await tx.fotofficePedidoCuota.findMany({ where: { workspaceId: d.workspaceId, pedidoId: p.id }, select: { amountArs: true } });
  const suma = cuotas.reduce((s, c) => s + decimalArsToMinor(c.amountArs), 0);
  return { ok: true, montoArs: precio, planCuadra: suma === aCentavos(totalNuevo) };
}

/** ¿El error es un corte con mensaje para la persona (y no una falla)? Para los llamadores que comparten la transacción. */
export function mensajeDeCorte(e: unknown): string | null {
  return e instanceof Corte ? e.mensaje : null;
}
