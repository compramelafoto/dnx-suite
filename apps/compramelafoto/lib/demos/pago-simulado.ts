/**
 * Pago simulado de las demos grabables: deja un pedido (de preventa o de la galería) exactamente
 * como lo deja un pago aprobado de Mercado Pago (`finalizeAlbumOrderMercadoPagoApproved`), pero
 * sin consultar a Mercado Pago y sin avisos: ni correos, ni WhatsApp, ni referidos, ni registro
 * de webhook.
 *
 * Solo para pedidos `isTest` de álbumes de usuarios demo.
 */

import { OrderOrigin, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { buildPreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { readPackDefinitionIdFromOrderPricingSnapshot } from "@/lib/preventa-canjeable/order-checkout-kind";
import { createOrganizerCommissionForPaidOrder } from "@/lib/school-organizer-commission";
import { ensureAlbumPackDesignsForPaidOrder } from "@/lib/design-v2/album-pack-designs";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import {
  evaluarPagoSimuladoGaleria,
  rutaDescargaDelPedido,
  type ActorDemo,
} from "@/lib/demos/pago-simulado-galeria";

export function mpPaymentIdSimulado(orderId: number): string {
  return `SIM-${orderId}`;
}

export async function finalizeAlbumOrderSimulatedApproved(
  orderId: number,
): Promise<{ ok: true; packToken: string | null } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { album: { select: { userId: true, selectedLabId: true } } },
  });
  if (!order) return { ok: false, error: "order_not_found" };
  if (!order.isTest) return { ok: false, error: "order_not_test" };
  if (order.origin !== OrderOrigin.PREVENTA_PACK) return { ok: false, error: "order_not_preventa" };
  if (order.status === "PAID") {
    const token = await createPackAccessTokenForOrder(orderId, { revokeExisting: true });
    return { ok: true, packToken: token?.token ?? null };
  }
  if (order.status !== "PENDING" && order.status !== "FAILED") {
    return { ok: false, error: `order_not_payable:${order.status}` };
  }

  const percent = await resolveClientMarketplaceFeePercent({
    photographerId: order.album?.userId ?? null,
    labId: order.album?.selectedLabId ?? null,
  });
  const extensionSurchargeCents = Number(order.extensionSurchargeCents ?? 0);
  const baseTotalCents = Math.max(0, order.totalCents - extensionSurchargeCents);
  const platformCommissionCents = feeFromTotal(baseTotalCents, percent) + extensionSurchargeCents;

  let preventaPackSnapshotJson: Prisma.InputJsonValue | undefined;
  if (order.preventaPackSnapshotJson == null) {
    const packDefId = readPackDefinitionIdFromOrderPricingSnapshot(order.pricingSnapshot);
    if (packDefId == null) return { ok: false, error: "preventa_pack_missing_pack_definition" };
    const packRow = await prisma.packDefinition.findFirst({
      where: { id: packDefId, albumId: order.albumId },
      include: {
        benefits: {
          orderBy: { sortOrder: "asc" },
          include: {
            template: { select: { name: true } },
            photographerProduct: { select: { name: true } },
          },
        },
      },
    });
    if (!packRow) return { ok: false, error: "preventa_pack_not_found" };
    preventaPackSnapshotJson = {
      ...buildPreventaPackSnapshotV1(packRow, new Date()),
      priceClientArs: clientTotalFromPhotographerBaseArs(packRow.priceClientArs, percent),
    } as unknown as Prisma.InputJsonValue;
  }

  await ensureDigitalDelivery(orderId);

  const paymentId = mpPaymentIdSimulado(orderId);
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      mpPaymentId: paymentId,
      platformCommissionCents,
      ...(preventaPackSnapshotJson !== undefined ? { preventaPackSnapshotJson } : {}),
    },
  });

  if (order.preCompraPaymentRef) {
    const pcoId = parseInt(String(order.preCompraPaymentRef).trim(), 10);
    if (Number.isFinite(pcoId) && pcoId > 0) {
      await prisma.preCompraOrder.updateMany({
        where: { id: pcoId, albumId: order.albumId, status: "CREATED" },
        data: { status: "PAID_HELD" },
      });
    }
  }

  // Un link nuevo cada vez: en la demo se repite la compra muchas veces.
  let packToken: string | null = null;
  try {
    packToken = (await createPackAccessTokenForOrder(orderId, { revokeExisting: true }))?.token ?? null;
  } catch (err) {
    console.error("[DEMO] pack-access-token falló", { orderId, err });
  }

  for (const eventType of ["PAYMENT_APPROVED", "CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
    await registerAuditEvent({
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: orderId,
      targetAlbumId: order.albumId,
      eventType,
    });
  }

  try {
    await createOrganizerCommissionForPaidOrder({ orderId, paymentId });
  } catch (err) {
    console.error("[DEMO] comisión del colegio falló", err);
  }

  try {
    await prisma.printOrder.updateMany({
      where: { tags: { has: `ALBUM_ORDER:${orderId}` } },
      data: { paymentStatus: "PAID", mpPaymentId: paymentId, statusUpdatedAt: new Date() },
    });
  } catch (err) {
    console.error("[DEMO] espejo de impresión falló", err);
  }

  try {
    await ensureAlbumPackDesignsForPaidOrder(orderId);
  } catch (err) {
    console.error("[DEMO] armado de diseños falló", { orderId, err });
  }

  return { ok: true, packToken };
}

/**
 * Hermana de `finalizeAlbumOrderSimulatedApproved` para la compra de la galería
 * (`/a/[id]/comprar`): deja el pedido como un pago aprobado de Mercado Pago (entrega digital,
 * comisión de plataforma, espejo de impresión, diseños) sin consultar a Mercado Pago y sin
 * avisos: ni correos, ni WhatsApp, ni referidos, ni registro de webhook.
 *
 * Revisa otra vez la guarda completa (`evaluarPagoSimuladoGaleria`): pedido `isTest`, que no sea
 * de preventa, de un álbum cuyo dueño es un usuario demo, y que quien paga sea ese dueño o tenga
 * la demo activa.
 */
export async function finalizeAlbumGalleryOrderSimulatedApproved(
  orderId: number,
  actor: ActorDemo,
): Promise<{ ok: true; destino: string | null; albumId: number } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { productType: true } },
      album: { select: { userId: true, selectedLabId: true, user: { select: { id: true, tags: true } } } },
    },
  });
  const guarda = evaluarPagoSimuladoGaleria({
    pedido: order ? { isTest: order.isTest, origin: order.origin ?? null, status: order.status } : null,
    dueno: order?.album?.user ?? null,
    actor,
  });
  if (!guarda.ok) return guarda;
  if (!order) return { ok: false, error: "order_not_found" };

  if (guarda.yaPagado) {
    // Se repite la grabación: vuelve a la misma descarga.
    await ensureDigitalDelivery(orderId);
  } else {
    const hasPrintItems = order.items.some((it) => it.productType === "PRINT");
    const feeInput = {
      photographerId: order.album?.userId ?? null,
      labId: order.album?.selectedLabId ?? null,
    };
    const percent = hasPrintItems
      ? await resolvePlatformCommissionPercent(feeInput)
      : await resolveClientMarketplaceFeePercent(feeInput);
    const extensionSurchargeCents = Number(order.extensionSurchargeCents ?? 0);
    const baseTotalCents = Math.max(0, order.totalCents - extensionSurchargeCents);
    const platformCommissionCents = feeFromTotal(baseTotalCents, percent) + extensionSurchargeCents;

    // Pedido `isTest`: arma el token y el ZIP, pero no avisa por correo.
    await ensureDigitalDelivery(orderId);

    const paymentId = mpPaymentIdSimulado(orderId);
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID", mpPaymentId: paymentId, platformCommissionCents },
    });

    for (const eventType of ["PAYMENT_APPROVED", "CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
      await registerAuditEvent({
        targetOrderType: "ALBUM_ORDER",
        targetOrderId: orderId,
        targetAlbumId: order.albumId,
        eventType,
      });
    }

    try {
      await createOrganizerCommissionForPaidOrder({ orderId, paymentId });
    } catch (err) {
      console.error("[DEMO] comisión del organizador falló", err);
    }

    try {
      await prisma.printOrder.updateMany({
        where: { tags: { has: `ALBUM_ORDER:${orderId}` } },
        data: { paymentStatus: "PAID", mpPaymentId: paymentId, statusUpdatedAt: new Date() },
      });
    } catch (err) {
      console.error("[DEMO] espejo de impresión falló", err);
    }

    try {
      await ensureAlbumPackDesignsForPaidOrder(orderId);
    } catch (err) {
      console.error("[DEMO] armado de diseños falló", { orderId, err });
    }
  }

  const tokens = await getOrderDownloadTokens(orderId);
  const token = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId)?.token ?? null;
  return { ok: true, destino: rutaDescargaDelPedido(token), albumId: order.albumId };
}
