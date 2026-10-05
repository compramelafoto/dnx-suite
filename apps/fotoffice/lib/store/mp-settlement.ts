import "server-only";
import { prisma } from "@repo/db";
import { recordCollectionFees, recordPartialRefund, reverseCollection } from "@/lib/cash/collection";
import { voidSale } from "@/lib/sales/void-sale";
import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";

/**
 * Lo que pasa con un pedido de la tienda después de cobrado: las comisiones de Mercado Pago y
 * de la plataforma en Caja, y la devolución o el contracargo.
 *
 * El ingreso lo deposita `recordSale` como `sales/<saleId>`; acá cuelgan de ese mismo asiento.
 */

const CON_VENTA = ["PAID", "READY", "SHIPPED", "DELIVERED"];

export async function recordStoreOrderFees(orderId: string, facts: MpPaymentFacts): Promise<void> {
  const pedido = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    select: { workspaceId: true, saleId: true, mpPaymentId: true },
  });
  if (!pedido?.saleId || pedido.mpPaymentId !== facts.id) return;
  const saleId = pedido.saleId;
  await prisma.$transaction(async (tx) => {
    await recordCollectionFees(tx, {
      workspaceId: pedido.workspaceId,
      sourceModule: "sales",
      sourceRef: saleId,
      mpFeeMinor: facts.mpFeeMinor,
      platformFeeMinor: facts.platformFeeMinor,
    });
    if (facts.refundedMinor > 0 && facts.status === "approved") {
      await recordPartialRefund(tx, {
        workspaceId: pedido.workspaceId,
        sourceModule: "sales",
        sourceRef: saleId,
        refundedMinor: facts.refundedMinor,
        occurredAt: facts.lastUpdatedAt ?? new Date(),
      });
    }
  });
}

/**
 * Mercado Pago devolvió el pago o el comprador lo desconoció: el pedido se cancela, la venta
 * se anula (vuelve el stock y sale de Caja) y se anulan también las comisiones.
 */
export async function refundStoreOrder(orderId: string, facts: MpPaymentFacts): Promise<{ applied: boolean }> {
  const pedido = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, workspaceId: true, saleId: true, status: true, mpPaymentId: true, orderNumber: true },
  });
  if (!pedido || pedido.mpPaymentId !== facts.id) return { applied: false };

  const motivo =
    facts.status === "charged_back"
      ? "El comprador desconoció el pago (contracargo)"
      : "Mercado Pago devolvió el pago";

  let applied = false;
  await prisma.$transaction(async (tx) => {
    if (pedido.saleId && CON_VENTA.includes(pedido.status)) {
      const venta = await tx.sale.findFirst({
        where: { id: pedido.saleId, workspaceId: pedido.workspaceId },
        select: { status: true },
      });
      if (venta && venta.status !== "ANULADA") {
        const r = await voidSale(tx, {
          workspaceId: pedido.workspaceId,
          saleId: pedido.saleId,
          reason: `Pedido online #${pedido.orderNumber}: ${motivo}`,
          userId: null,
          fromStoreOrder: true,
        });
        if (!r.ok) throw new Error(r.error);
      }
    }
    if (pedido.status !== "CANCELLED") {
      await tx.storeOrder.update({
        where: { id: pedido.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), holdExpiresAt: null },
      });
      await tx.storeOrderEvent.create({
        data: { orderId: pedido.id, fromStatus: pedido.status, toStatus: "CANCELLED", actorUserId: null, note: motivo },
      });
      applied = true;
    }
    if (pedido.saleId) {
      const r = await reverseCollection(tx, {
        workspaceId: pedido.workspaceId,
        sourceModule: "sales",
        sourceRef: pedido.saleId,
        reason: motivo,
        occurredAt: facts.lastUpdatedAt ?? new Date(),
      });
      if (r.reversed > 0) applied = true;
    }
  });
  return { applied };
}
