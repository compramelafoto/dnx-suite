import "server-only";
import { prisma } from "@repo/db";
import { sanitizeError } from "@/lib/payments/connect/log";
import { sendCreditFailureAlert } from "./emails";
import { checkStoreOrderPayment, type StorePaymentCheck } from "./mp-payment";

/**
 * La conciliación de la tienda (cron cada 15 minutos). Dos pasadas:
 *
 * 1. Pedidos que esperan el pago con la retención vencida: antes de darlos por vencidos se le
 *    pregunta a Mercado Pago. Si el pago estaba aprobado y el aviso nunca llegó, se acredita. Si
 *    no, pasa a `EXPIRED` (el stock ya no lo retiene desde que venció: ver `reservedQtyByKey`).
 * 2. Pedidos vencidos de las últimas 48 h sin pago: se vuelven a consultar una vez por corrida,
 *    los más recientes primero. Es el pago tardío (en efectivo, o aprobado después de la
 *    retención) que el aviso no trajo.
 *
 * Cada pedido va aislado: si uno falla (siempre, por lo que sea), se registra y se sigue con el
 * siguiente. Si no, un solo pedido roto frenaría la conciliación de todos para siempre.
 *
 * Idempotente: acreditar lo es (`creditStorePayment`) y vencer sólo cambia un pedido que sigue
 * esperando el pago. Correrla de más no rompe nada.
 */

const VENTANA_TARDIOS_MS = 48 * 60 * 60 * 1000;

export const NOTA_FALLO_ACREDITACION = "Pago aprobado que no se pudo acreditar: revisar";

export async function reconcilePendingOrders(
  opts: { now?: Date; limit?: number } = {},
): Promise<{ checked: number; credited: number; expired: number; failed: number }> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 100;
  const reporte = { checked: 0, credited: 0, expired: 0, failed: 0 };

  // Los ya vencidos se leen ANTES de vencer los de esta corrida: así cada pedido se consulta
  // una sola vez por corrida.
  const tardios = await prisma.storeOrder.findMany({
    where: {
      status: "EXPIRED",
      mpPaymentId: null,
      holdExpiresAt: { gte: new Date(now.getTime() - VENTANA_TARDIOS_MS) },
    },
    select: { id: true, workspaceId: true },
    orderBy: { updatedAt: "desc" },
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
    try {
      const r = await checkStoreOrderPayment({ workspaceId: pedido.workspaceId, orderId: pedido.id });
      if (await contarAcreditacion(r, pedido, reporte)) continue;
      // Mercado Pago no respondió: se deja esperando y se reintenta en la próxima corrida. No
      // retiene stock igual (la retención ya venció), así que esperar no le quita nada a nadie.
      // Sin cobros habilitados sí vence: ahí no hay pago que buscar. Y pasadas 48 h también: un
      // pedido al que nunca se le puede preguntar no puede ocupar la cola para siempre (si el pago
      // aparece, el aviso de Mercado Pago lo acredita igual sobre el vencido).
      const reciente = (pedido.holdExpiresAt?.getTime() ?? 0) >= now.getTime() - VENTANA_TARDIOS_MS;
      if (r.outcome === "unavailable" && reciente) continue;
      if (await vencer(pedido)) reporte.expired++;
    } catch (error) {
      reporte.failed++;
      registrarError(pedido.id, error);
    }
  }

  for (const pedido of tardios) {
    reporte.checked++;
    try {
      const r = await checkStoreOrderPayment({ workspaceId: pedido.workspaceId, orderId: pedido.id });
      await contarAcreditacion(r, pedido, reporte);
    } catch (error) {
      reporte.failed++;
      registrarError(pedido.id, error);
    }
  }

  return reporte;
}

/**
 * Suma al reporte lo que pasó con el pago. Devuelve true si el pedido ya está resuelto por ahora
 * (acreditado, o con un pago aprobado que no se pudo acreditar: ése NO se vence).
 */
async function contarAcreditacion(
  r: StorePaymentCheck,
  pedido: { id: string; workspaceId: string },
  reporte: { credited: number; failed: number },
): Promise<boolean> {
  if (r.outcome === "credited") {
    if (r.result.applied) reporte.credited++;
    return true;
  }
  if (r.outcome === "credit_failed") {
    reporte.failed++;
    await anotarFalloDeAcreditacion(pedido);
    return true;
  }
  return false;
}

/**
 * Deja constancia en el pedido (una sola vez: si el último evento ya lo dice, no se repite) y
 * avisa a la institución. El cron lo sigue reintentando en cada corrida.
 */
async function anotarFalloDeAcreditacion(pedido: { id: string; workspaceId: string }): Promise<void> {
  const actual = await prisma.storeOrder.findFirst({
    where: { id: pedido.id, workspaceId: pedido.workspaceId },
    select: { status: true, events: { orderBy: { createdAt: "desc" }, take: 1, select: { note: true } } },
  });
  if (!actual || actual.events[0]?.note === NOTA_FALLO_ACREDITACION) return;
  await prisma.storeOrderEvent.create({
    data: { orderId: pedido.id, fromStatus: actual.status, toStatus: actual.status, note: NOTA_FALLO_ACREDITACION },
  });
  try {
    await sendCreditFailureAlert({ workspaceId: pedido.workspaceId, orderId: pedido.id });
  } catch (error) {
    registrarError(pedido.id, error);
  }
}

function registrarError(storeOrderId: string, error: unknown): void {
  console.error("[fotoffice][tienda] falló la conciliación de un pedido", {
    storeOrderId,
    detalle: sanitizeError(error),
  });
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
