/**
 * Lo que pasa después de canjear un pack de preventa, igual que al cerrar un canje externo
 * (`lib/canje-externo/complete-prepaid-order`): comprobante a la familia, aviso al fotógrafo
 * de que tiene un pedido para entregar y link directo a las descargas si hay digitales.
 *
 * Antes el canje sólo preparaba la entrega digital: el fotógrafo no se enteraba de que tenía
 * impresas para entregar y la familia terminaba en una pantalla sin link.
 */

import { prisma } from "@/lib/prisma";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";

export async function completePreventaRedemption(
  redemptionOrderId: number,
  packOrderId: number,
  baseUrl: string
): Promise<{ downloadUrl: string | null }> {
  const order = await prisma.order.findUnique({
    where: { id: redemptionOrderId },
    select: { origin: true, createdAt: true, items: { select: { productType: true } } },
  });
  if (!order) return { downloadUrl: null };

  // El canje no copia el nombre del comprador: sin esto el fotógrafo recibía "Nuevo pedido -
  // <email>" y en su panel el pedido figuraba sin nombre.
  const pack = await prisma.order.findUnique({
    where: { id: packOrderId },
    select: { buyerName: true },
  });
  if (pack?.buyerName) {
    await prisma.order.update({
      where: { id: redemptionOrderId },
      data: { buyerName: pack.buyerName },
    });
  }

  try {
    await runAlbumOrderPaidSideEffects({
      orderId: redemptionOrderId,
      origin: order.origin,
      items: order.items,
      paymentRef: `CANJE-PREVENTA-${packOrderId}`,
    });
  } catch (err) {
    console.error("[preventa_redeem] side_effects_failed", { redemptionOrderId, err });
  }

  if (!order.items.some((i) => i.productType === "DIGITAL")) return { downloadUrl: null };
  const accessToken = await getOrderDownloadCenterAccessToken(redemptionOrderId);
  if (!accessToken) return { downloadUrl: null };
  return {
    downloadUrl: resolveClientDigitalDownloadLinks({
      orderId: redemptionOrderId,
      orderCreatedAt: order.createdAt,
      accessToken,
      baseUrl,
      context: "canje_preventa",
    }).primaryClientUrl,
  };
}
