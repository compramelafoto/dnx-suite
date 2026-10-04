import "server-only";
import { prisma } from "@repo/db";
import { checkStoreOrderPayment } from "./mp-payment";

/**
 * La conciliación de la tienda (cron cada 15 minutos). Dos pasadas:
 *
 * 1. Pedidos que esperan el pago con la retención vencida: antes de darlos por vencidos se le
 *    pregunta a Mercado Pago. Si el pago estaba aprobado y el aviso nunca llegó, se acredita. Si
 *    no, pasa a `EXPIRED` (el stock ya no lo retiene desde que venció: ver `reservedQtyByKey`).
 * 2. Pedidos vencidos de las últimas 48 h sin pago: se vuelven a consultar una vez por corrida.
 *    Es el pago tardío (en efectivo, o aprobado después de la retención) que el aviso no trajo.
 *
 * Idempotente: acreditar lo es (`creditStorePayment`) y vencer sólo cambia un pedido que sigue
 * esperando el pago. Correrla de más no rompe nada.
 */

const VENTANA_TARDIOS_MS = 48 * 60 * 60 * 1000;

export async function reconcilePendingOrders(
  opts: { now?: Date; limit?: number } = {},
): Promise<{ checked: number; credited: number; expired: number }> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 100;
  const reporte = { checked: 0, credited: 0, expired: 0 };

  // Los ya vencidos se leen ANTES de vencer los de esta corrida: así cada pedido se consulta
  // una sola vez por corrida.
  const tardios = await prisma.storeOrder.findMany({
    where: {
      status: "EXPIRED",
      mpPaymentId: null,
      holdExpiresAt: { gte: new Date(now.getTime() - VENTANA_TARDIOS_MS) },
    },
    select: { id: true, workspaceId: true },
    orderBy: { holdExpiresAt: "asc" },
    take: limit,
  });
  const vencidos = await prisma.storeOrder.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lt: now } },
    select: { id: true, workspaceId: true, holdExpiresAt: true },
    orderBy: { holdExpiresAt: "asc" },
    take: limit,
  });

  for (const pedido of vencidos) {
    reporte.checked++;
    const r = await checkStoreOrderPayment({ workspaceId: pedido.workspaceId, orderId: pedido.id });
    if (r.outcome === "credited") {
      if (r.result.applied) reporte.credited++;
      continue;
    }
    // Mercado Pago no respondió: se deja esperando y se reintenta en la próxima corrida. No
    // retiene stock igual (la retención ya venció), así que esperar no le quita nada a nadie.
    // Sin cobros habilitados sí vence: ahí no hay pago que buscar. Y pasadas 48 h también: un
    // pedido al que nunca se le puede preguntar no puede ocupar la cola para siempre (si el pago
    // aparece, el aviso de Mercado Pago lo acredita igual sobre el vencido).
    const reciente = (pedido.holdExpiresAt?.getTime() ?? 0) >= now.getTime() - VENTANA_TARDIOS_MS;
    if (r.outcome === "unavailable" && reciente) continue;
    if (await vencer(pedido)) reporte.expired++;
  }

  for (const pedido of tardios) {
    reporte.checked++;
    const r = await checkStoreOrderPayment({ workspaceId: pedido.workspaceId, orderId: pedido.id });
    if (r.outcome === "credited" && r.result.applied) reporte.credited++;
  }

  return reporte;
}

/** Vence un pedido sólo si sigue esperando el pago: si en el medio se acreditó, no se toca. */
async function vencer(pedido: { id: string; workspaceId: string }): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.storeOrder.updateMany({
      where: { id: pedido.id, workspaceId: pedido.workspaceId, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED" },
    });
    if (r.count === 0) return false;
    await tx.storeOrderEvent.create({
      data: {
        orderId: pedido.id,
        fromStatus: "PENDING_PAYMENT",
        toStatus: "EXPIRED",
        note: "Venció la reserva sin pago aprobado en Mercado Pago",
      },
    });
    return true;
  });
}
