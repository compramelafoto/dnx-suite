import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { MENSAJES_PEDIDO } from "./acceso";
import { esEstadoPedido, OPCIONES_TRANSACCION_PEDIDO } from "./constantes";
import { armarItemCargo, hayLugarParaOtroItem, itemDeCargo, itemsConCargo, itemsSinCargo, totalesConCargo } from "./cargos-puro";
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
 * - Quitar un cargo (`quitarCargoDelPedido`) sólo se puede mientras su cuota no tenga ningún
 *   cobro imputado (ni siquiera anulado: la FK lo frena).
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
  conCobros: "Ese cargo ya tiene un pago registrado: no se puede quitar.",
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

/**
 * Deshace un cargo DENTRO de la transacción del llamador: saca el renglón, baja el total y borra su
 * cuota (las de después suben un lugar). Sólo si la cuota no tiene imputaciones. Si la cuota ya no
 * existe (alguien rehízo el plan), no toca el total: el plan ya se cuadró a mano.
 */
export async function quitarCargoEnTransaccion(tx: Tx, d: { workspaceId: string; pedidoId: string; cuotaId: string }): Promise<void> {
  await bloquearPedido(tx, d.pedidoId);
  const p = await tx.fotofficePedido.findFirst({
    where: { id: d.pedidoId, workspaceId: d.workspaceId },
    select: { id: true, items: true, totals: true, totalArs: true },
  });
  if (!p) throw new Corte(MENSAJES_CARGO.noExiste);
  const cuota = await tx.fotofficePedidoCuota.findFirst({
    where: { id: d.cuotaId, workspaceId: d.workspaceId, pedidoId: p.id },
    select: { id: true, position: true, amountArs: true },
  });
  if (!cuota) return;
  const imputaciones = await tx.fotofficeCobroImputacion.count({ where: { workspaceId: d.workspaceId, cuotaId: cuota.id } });
  if (imputaciones > 0) throw new Corte(MENSAJES_CARGO.conCobros);
  const monto = pesosDeBase(cuota.amountArs);
  const itemId = itemDeCargo(cuota.id);
  const items = itemsSinCargo(p.items, itemId);
  await tx.fotofficePedidoCuota.deleteMany({ where: { id: cuota.id, workspaceId: d.workspaceId } });
  const siguientes = await tx.fotofficePedidoCuota.findMany({
    where: { workspaceId: d.workspaceId, pedidoId: p.id, position: { gt: cuota.position } },
    orderBy: [{ position: "asc" }],
    select: { id: true, position: true },
  });
  for (const c of siguientes) {
    await tx.fotofficePedidoCuota.update({ where: { id: c.id }, data: { position: c.position - 1 }, select: { id: true } });
  }
  await tx.fotofficePedido.update({
    where: { id: p.id },
    data: {
      ...(items ? { items: items as unknown as Prisma.InputJsonValue, totals: totalesConCargo(p.totals, itemId, monto, -1) as Prisma.InputJsonValue } : {}),
      totalArs: pesosParaBase(Math.max(0, pesosDeBase(p.totalArs) - monto)),
    },
    select: { id: true },
  });
}

/** `quitarCargoEnTransaccion` en su propia transacción. No lanza. */
export async function quitarCargoDelPedido(d: { workspaceId: string; pedidoId: string; cuotaId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$transaction((tx) => quitarCargoEnTransaccion(tx, d), OPCIONES_TRANSACCION_PEDIDO);
    return { ok: true };
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("quitarCargoDelPedido", e);
    return { ok: false, error: MENSAJES_CARGO.fallo };
  }
}

/** ¿El error es un corte con mensaje para la persona (y no una falla)? Para los llamadores que comparten la transacción. */
export function mensajeDeCorte(e: unknown): string | null {
  return e instanceof Corte ? e.mensaje : null;
}
