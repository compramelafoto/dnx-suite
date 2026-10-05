/**
 * Cierra un pedido que quedó en $0 porque el combo pagado por fuera cubrió todo: no pasa
 * por Mercado Pago, así que acá se hace lo que haría la aprobación del pago (entrega
 * digital, liberar datos al fotógrafo, comprobante y aviso de impresión).
 */

import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";

export async function completePrepaidAlbumOrder(orderId: number, voucherOrderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { albumId: true, origin: true, items: { select: { productType: true } } },
  });
  if (!order) return;

  await ensureDigitalDelivery(orderId);

  for (const eventType of ["CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
    await registerAuditEvent({
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: orderId,
      targetAlbumId: order.albumId,
      eventType,
      metadata: { prepaidVoucherOrderId: voucherOrderId },
    });
  }

  await runAlbumOrderPaidSideEffects({
    orderId,
    origin: order.origin,
    items: order.items,
    paymentRef: `CANJE-EXTERNO-${voucherOrderId}`,
  });
}
