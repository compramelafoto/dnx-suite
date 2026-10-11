import "server-only";
import { prisma } from "@repo/db";
import { PENDING_HOLD_HOURS, arMinutesOfDay } from "@repo/muestras";
import { conciliarPedido } from "./conciliar";

/**
 * El barrido de la venta (etapa 8, D22, D29), cada 10 minutos desde `/api/cron/ventas`:
 * (1) vence las reservas sin Order; (2) pregunta a Mercado Pago por los pedidos pendientes con
 * Order (los de más de 72 horas quedan con una alerta); (3) una vez por día, entre las 4:00 y las
 * 4:10 de Argentina, repasa los pagados de los últimos 60 días buscando devoluciones y contracargos
 * hechos fuera. Devuelve sólo cantidades: nada de datos personales.
 */
export type ResumenDelBarrido = { vencidos: number; consultados: number; alertas: number; repasados: number };

const HORA = 60 * 60_000;
const DIA = 24 * HORA;
const LOTE_VENCER = 200;
const LOTE_PENDIENTES = 50;
const LOTE_PAGADOS = 100;
const SIN_SABER = new Set(["CREATING", "UNKNOWN_CREATE"]);

async function vencerSinOrden(ahora: Date): Promise<number> {
  const viejos = await prisma.culturalSaleOrder.findMany({
    where: { status: "PENDING_PAYMENT", providerOrderId: null, holdExpiresAt: { lt: ahora } },
    select: { id: true, copyId: true, providerStatus: true },
    orderBy: { holdExpiresAt: "asc" },
    take: LOTE_VENCER,
  });
  let vencidos = 0;
  for (const p of viejos) {
    const hecho = await prisma.$transaction(async (tx) => {
      const { count } = await tx.culturalSaleOrder.updateMany({
        where: { id: p.id, status: "PENDING_PAYMENT", providerOrderId: null },
        data: { status: "EXPIRED", copyId: null, lastSyncedAt: ahora },
      });
      if (count === 0) return false;
      if (p.copyId) {
        await tx.culturalEditionCopy.updateMany({ where: { id: p.copyId, orderId: p.id, status: "RESERVED" }, data: { status: "RELEASED", reservedUntil: null, orderId: null } });
      }
      // Si el pago se cayó a mitad de camino, puede haber una Order: si llega a pagarse, el aviso de
      // CLF la encuentra por la referencia y la conciliación busca otro número (D23).
      const detalle = SIN_SABER.has(p.providerStatus ?? "")
        ? "ALERT_UNKNOWN_CREATE: la reserva venció sin saber si Mercado Pago creó la Order"
        : "Reserva vencida sin pago";
      await tx.culturalSaleEvent.create({ data: { orderId: p.id, source: "SWEEP", fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED", detail: detalle } });
      return true;
    });
    if (hecho) vencidos++;
  }
  return vencidos;
}

const ALERTA_PENDIENTE = "ALERT_STALE_PENDING: Mercado Pago no confirma el pago hace más de 72 horas";

export async function barrerVentas(ahora: Date = new Date()): Promise<ResumenDelBarrido> {
  const vencidos = await vencerSinOrden(ahora);

  const pendientes = await prisma.culturalSaleOrder.findMany({
    where: { status: "PENDING_PAYMENT", providerOrderId: { not: null } },
    select: { id: true, providerOrderId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: LOTE_PENDIENTES,
  });
  let alertas = 0;
  for (const p of pendientes) {
    const r = await conciliarPedido({ providerOrderId: p.providerOrderId! }, "SWEEP");
    const sigue = (r?.estado ?? "PENDING_PAYMENT") === "PENDING_PAYMENT";
    if (sigue && ahora.getTime() - p.createdAt.getTime() > PENDING_HOLD_HOURS * HORA) {
      const ya = await prisma.culturalSaleEvent.findFirst({ where: { orderId: p.id, detail: ALERTA_PENDIENTE }, select: { id: true } });
      if (!ya) {
        await prisma.culturalSaleEvent.create({ data: { orderId: p.id, source: "SWEEP", detail: ALERTA_PENDIENTE } });
        alertas++;
      }
    }
  }

  let repasados = 0;
  const minuto = arMinutesOfDay(ahora);
  if (minuto >= 4 * 60 && minuto < 4 * 60 + 10) {
    const pagados = await prisma.culturalSaleOrder.findMany({
      where: { status: { in: ["PAID", "PAID_NO_COPY"] }, providerOrderId: { not: null }, paidAt: { gte: new Date(ahora.getTime() - 60 * DIA) } },
      select: { providerOrderId: true },
      orderBy: { lastSyncedAt: "asc" },
      take: LOTE_PAGADOS,
    });
    for (const p of pagados) {
      await conciliarPedido({ providerOrderId: p.providerOrderId! }, "SWEEP");
      repasados++;
    }
  }

  return { vencidos, consultados: pendientes.length, alertas, repasados };
}
