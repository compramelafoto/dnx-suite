/**
 * Cierra un pedido que quedó en $0 porque el combo pagado por fuera cubrió todo: no pasa
 * por Mercado Pago, así que acá se hace lo que haría la aprobación del pago (entrega
 * digital, liberar datos al fotógrafo, comprobante y aviso de impresión).
 */

import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";

/**
 * Devuelve el link al centro de descargas cuando el pedido tiene digitales, para que la
 * pantalla final del canje lleve directo a bajarlas (además del correo, que sale cuando el
 * ZIP está listo). Mismo armado que la confirmación de un pago de Mercado Pago.
 */
export async function completePrepaidAlbumOrder(
  orderId: number,
  voucherOrderId: number,
  baseUrl: string
): Promise<{ downloadUrl: string | null }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { albumId: true, origin: true, createdAt: true, items: { select: { productType: true } } },
  });
  if (!order) return { downloadUrl: null };

  const delivery = await ensureDigitalDelivery(orderId);
  let downloadUrl: string | null = null;
  if (delivery) {
    const accessToken = await getOrderDownloadCenterAccessToken(orderId);
    if (accessToken) {
      downloadUrl = resolveClientDigitalDownloadLinks({
        orderId,
        orderCreatedAt: order.createdAt,
        accessToken,
        baseUrl,
        context: "canje_externo",
      }).primaryClientUrl;
    }
  }

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

  return { downloadUrl };
}
