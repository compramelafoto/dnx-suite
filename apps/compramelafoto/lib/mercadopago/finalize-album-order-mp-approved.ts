import { OrderOrigin, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clientTotalFromPhotographerBaseArs,
  resolveClientMarketplaceFeePercent,
} from "@/lib/pricing/client-price";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { getPaymentById, type PaymentInfo } from "@/lib/mercadopago";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import {
  queueOrderConfirmationEmail,
  queuePhotographerOrderNotification,
  queuePhotographerPrintOrderNotification,
} from "@/lib/order-confirmation-email";
import { deliverOrderByWhatsApp } from "@/lib/whatsapp/sendOrderDelivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { consumeReferralEarningsForDiscount } from "@/lib/referral/consume-referral-earnings-discount";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { buildPreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { ensurePackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { queuePreventaPackAccessEmail } from "@/lib/order-confirmation-email";
import {
  readPackDefinitionIdFromOrderPricingSnapshot,
  readPackDefinitionIdFromPaymentMetadata,
} from "@/lib/preventa-canjeable/order-checkout-kind";
import { getAlbumOrderFulfillmentFromItems } from "@/lib/order-fulfillment";
import { createOrganizerCommissionForPaidOrder } from "@/lib/school-organizer-commission";
import { ensureEventOrganizerCommissionSnapshotForPaidOrder } from "@/lib/event-organizer-commission-snapshot";
import { resolveAlbumOrderMpAccessTokenByOrderId } from "@/lib/mercadopago/resolve-album-order-mp-credentials";

export type FinalizeAlbumOrderMpResult =
  | { ok: true; skipped: "already_paid"; orderId: number; paymentId: string }
  | { ok: true; applied: true; orderId: number; paymentId: string }
  | { ok: false; orderId: number; paymentId?: string; error: string };

function parseExternalReferenceOrderId(externalRef: string | undefined): number | null {
  if (!externalRef) return null;
  let oid = Number(externalRef);
  if (Number.isFinite(oid)) return oid;
  if (externalRef.includes(":")) {
    const match = externalRef.match(/:(\d+)$/);
    if (match) {
      oid = Number(match[1]);
      if (Number.isFinite(oid)) return oid;
    }
  }
  return null;
}

/**
 * Marca un pedido de álbum como PAID y dispara entrega digital, emails y efectos colaterales,
 * validando el pago en Mercado Pago. Usado por webhook y por reconciliación de pendientes.
 */
export async function finalizeAlbumOrderMercadoPagoApproved(
  orderId: number,
  paymentId: string,
  options?: { accessTokenOverride?: string }
): Promise<FinalizeAlbumOrderMpResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      album: { select: { userId: true, eventId: true, isTest: true, selectedLabId: true } },
      items: { select: { productType: true } },
    },
  });

  if (!order) {
    return { ok: false, orderId, paymentId, error: "order_not_found" };
  }

  const collectorAccessToken =
    options?.accessTokenOverride ??
    (await resolveAlbumOrderMpAccessTokenByOrderId(orderId));

  if (order.status === "PAID") {
    try {
      await ensureEventOrganizerCommissionSnapshotForPaidOrder(orderId, {
        accessTokenOverride: collectorAccessToken,
      });
    } catch (err: unknown) {
      console.error("[event-organizer-commission] ensure_failed_already_paid", err);
    }
    return { ok: true, skipped: "already_paid", orderId, paymentId };
  }

  const previousStatus = order.status;
  if (previousStatus !== "PENDING" && previousStatus !== "FAILED") {
    return { ok: false, orderId, paymentId, error: `order_not_payable:${previousStatus}` };
  }

  let pay: PaymentInfo;
  try {
    pay = await getPaymentById(String(paymentId), {
      accessTokenOverride: collectorAccessToken,
    });
  } catch {
    pay = await getPaymentById(String(paymentId), {});
  }

  if (pay.status !== "approved") {
    return {
      ok: false,
      orderId,
      paymentId,
      error: `payment_not_approved:${pay.status}`,
    };
  }

  const refOrderId = parseExternalReferenceOrderId(pay.external_reference);
  if (refOrderId !== orderId) {
    return {
      ok: false,
      orderId,
      paymentId,
      error: "external_reference_mismatch",
    };
  }

  const updateData: {
    status: "PAID";
    mpPaymentId: string;
    platformCommissionCents?: number;
  } = {
    status: "PAID",
    mpPaymentId: String(paymentId),
  };

  const hasPrintItems = order.items.some((it) => it.productType === "PRINT");
  const percent =
    order.origin === OrderOrigin.PREVENTA_PACK || !hasPrintItems
      ? await resolveClientMarketplaceFeePercent({
          photographerId: order.album?.userId ?? null,
          labId: order.album?.selectedLabId ?? null,
        })
      : await resolvePlatformCommissionPercent({
          photographerId: order.album?.userId ?? null,
          labId: order.album?.selectedLabId ?? null,
        });
  const finalizeFeeFlow =
    order.origin === OrderOrigin.PREVENTA_PACK
      ? ("PREVENTA_PACK" as const)
      : order.origin === OrderOrigin.PACK_REDEMPTION
        ? ("PACK_REDEMPTION" as const)
        : ("ALBUM_ORDER" as const);
  scheduleCheckoutFeeShadowCompare({
    site: hasPrintItems
      ? "finalize-album-order.mixed"
      : order.origin === OrderOrigin.PREVENTA_PACK
        ? "finalize-album-order.preventa-pack"
        : "finalize-album-order.album-order",
    legacyFeePercent: percent,
    resolveInput: {
      component: hasPrintItems ? "PRINT" : "DIGITAL",
      flow: finalizeFeeFlow,
      purpose: "ORGANIZER_BASE_EXTRACT",
      photographerId: order.album?.userId ?? null,
      labId: order.album?.selectedLabId ?? null,
      albumId: order.albumId,
      hasPrintItems,
      orderOrigin:
        order.origin === OrderOrigin.PREVENTA_PACK
          ? "PREVENTA_PACK"
          : order.origin === OrderOrigin.PACK_REDEMPTION
            ? "PACK_REDEMPTION"
            : "STANDARD_CHECKOUT",
    },
    orderId: order.id,
    albumId: order.albumId,
    photographerId: order.album?.userId ?? null,
    labId: order.album?.selectedLabId ?? null,
    hasPrintItems,
    hasOrganizer: order.album?.eventId != null,
    totalArsForEstimate: order.totalCents,
  });
  const extensionSurchargeCents = Number(order.extensionSurchargeCents ?? 0);
  const baseTotalCents = Math.max(0, order.totalCents - extensionSurchargeCents);
  const baseCommission = feeFromTotal(baseTotalCents, percent);
  updateData.platformCommissionCents = baseCommission + extensionSurchargeCents;
  const platformFeeCents = Number(updateData.platformCommissionCents ?? 0);

  let preventaPackSnapshotUpdate: Prisma.InputJsonValue | undefined;
  if (order.origin === OrderOrigin.PREVENTA_PACK) {
    // IDPOTENCIA FUERTE: si ya existe snapshot, NO volver a generarlo
    const snapshotExists = order.preventaPackSnapshotJson != null;

    if (!snapshotExists) {
      const packDefId =
        readPackDefinitionIdFromOrderPricingSnapshot(order.pricingSnapshot) ??
        readPackDefinitionIdFromPaymentMetadata(pay.metadata);
      if (packDefId == null) {
        return {
          ok: false,
          orderId,
          paymentId,
          error: "preventa_pack_missing_pack_definition",
        };
      }
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
      if (!packRow) {
        return {
          ok: false,
          orderId,
          paymentId,
          error: "preventa_pack_not_found",
        };
      }
      const snapshotBase = buildPreventaPackSnapshotV1(packRow, new Date());
      const clientUnitArs = clientTotalFromPhotographerBaseArs(packRow.priceClientArs, percent);
      preventaPackSnapshotUpdate = {
        ...snapshotBase,
        priceClientArs: clientUnitArs,
      } as unknown as Prisma.InputJsonValue;
    }
  }

  await ensureDigitalDelivery(orderId);

  const orderUpdatePayload: Prisma.OrderUpdateInput = { ...updateData };
  if (preventaPackSnapshotUpdate !== undefined) {
    orderUpdatePayload.preventaPackSnapshotJson = preventaPackSnapshotUpdate;
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: orderUpdatePayload,
    });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (
      msg.includes("platformCommissionCents") &&
      (msg.includes("Unknown argument") || msg.includes("Unknown column"))
    ) {
      const fallback: Prisma.OrderUpdateInput = {
        status: "PAID",
        mpPaymentId: String(paymentId),
      };
      if (preventaPackSnapshotUpdate !== undefined) {
        fallback.preventaPackSnapshotJson = preventaPackSnapshotUpdate;
      }
      await prisma.order.update({
        where: { id: orderId },
        data: fallback,
      });
    } else {
      throw err;
    }
  }

  if (order.origin === OrderOrigin.PREVENTA_PACK && order.preCompraPaymentRef) {
    const rawRef = String(order.preCompraPaymentRef).trim();
    const pcoId = parseInt(rawRef, 10);
    if (Number.isFinite(pcoId) && pcoId > 0) {
      await prisma.preCompraOrder.updateMany({
        where: {
          id: pcoId,
          albumId: order.albumId,
          status: "CREATED",
        },
        data: { status: "PAID_HELD" },
      });
    }
  }

  if (order.origin === OrderOrigin.PREVENTA_PACK) {
    try {
      const tokenData = await ensurePackAccessTokenForOrder(orderId);
      if (tokenData?.token) {
        const appUrl =
          process.env.APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
        const packAccessUrl = `${appUrl}/cliente/pack/${tokenData.token}`;
        await queuePreventaPackAccessEmail(orderId, packAccessUrl);
      }
    } catch (err) {
      console.error("pack-access-token create failed", { orderId });
    }
  }

  const targetAlbumId = order.albumId;
  await registerAuditEvent({
    targetOrderType: "ALBUM_ORDER",
    targetOrderId: orderId,
    targetAlbumId,
    eventType: "PAYMENT_APPROVED",
  });
  if (previousStatus === "FAILED") {
    await registerAuditEvent({
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: orderId,
      targetAlbumId,
      eventType: "MP_RECONCILIATION_ALBUM_FAILED_RECOVERED",
      metadata: {
        mpPaymentId: String(paymentId),
        previousStatus,
        message: "Pedido FAILED recuperado tras pago approved en Mercado Pago",
      },
    });
  }
  await registerAuditEvent({
    targetOrderType: "ALBUM_ORDER",
    targetOrderId: orderId,
    targetAlbumId,
    eventType: "CUSTOMER_DATA_RELEASED",
  });
  await registerAuditEvent({
    targetOrderType: "ALBUM_ORDER",
    targetOrderId: orderId,
    targetAlbumId,
    eventType: "ORDER_ITEMS_RELEASED",
  });

  if (order.album?.userId) {
    await createReferralEarningsForPaidSale({
      saleRef: `ALBUM_ORDER:${orderId}`,
      orderType: "ALBUM_ORDER",
      orderId,
      paymentId: String(paymentId),
      photographerUserId: order.album.userId,
      eventId: order.album?.eventId ?? null,
      grossPlatformFeeCents: platformFeeCents,
      referralFeeDiscountCents: order.referralFeeDiscountCents,
    });
  }

  const referralFeeDiscountCentsAlbum = Number(order.referralFeeDiscountCents ?? 0);
  if (referralFeeDiscountCentsAlbum > 0 && order.album?.userId) {
    await consumeReferralEarningsForDiscount(
      order.album.userId,
      referralFeeDiscountCentsAlbum,
      orderId,
      "ALBUM_ORDER"
    );
  }

  try {
    await createOrganizerCommissionForPaidOrder({
      orderId,
      paymentId: String(paymentId),
    });
  } catch (err: unknown) {
    console.error("Error creando comisión SCHOOL_ORGANIZER:", err);
  }

  try {
    const paymentApprovedAt = pay.date_approved ? new Date(pay.date_approved) : new Date();
    await ensureEventOrganizerCommissionSnapshotForPaidOrder(orderId, {
      paymentApprovedAt,
      accessTokenOverride: collectorAccessToken,
    });
  } catch (err: unknown) {
    console.error("[event-organizer-commission] ensure_failed", err);
  }

  const suppressClientDeliveryForPreventaPackOnly =
    order.origin === OrderOrigin.PREVENTA_PACK && order.items.length === 0;
  if (!suppressClientDeliveryForPreventaPackOnly) {
    queueOrderConfirmationEmail(orderId).catch((err) =>
      console.error("Error encolando email de confirmación de pedido:", err)
    );
    deliverOrderByWhatsApp(orderId).catch((err) =>
      console.error("Error en entrega WhatsApp post-compra:", err)
    );
  }

  const { hasDigitalItems, hasPrintItems: hasFulfillmentPrintItems } =
    getAlbumOrderFulfillmentFromItems(order.items ?? []);

  try {
    const tag = `ALBUM_ORDER:${orderId}`;
    await prisma.printOrder.updateMany({
      where: { tags: { has: tag } },
      data: {
        paymentStatus: "PAID",
        mpPaymentId: String(paymentId),
        statusUpdatedAt: new Date(),
      },
    });

    if (!hasFulfillmentPrintItems) {
      queuePhotographerOrderNotification(orderId).catch((err) =>
        console.error("Error encolando email al fotógrafo (nuevo pedido):", err)
      );
    } else if (hasDigitalItems) {
      // Mixto: un solo mail con contexto digital + impresión (no duplicar mail de PrintOrder)
      queuePhotographerOrderNotification(orderId).catch((err) =>
        console.error("Error encolando email al fotógrafo (pedido mixto álbum):", err)
      );
    } else {
      const mirror = await prisma.printOrder.findFirst({
        where: { tags: { has: tag } },
        select: { id: true },
      });
      if (mirror?.id) {
        queuePhotographerPrintOrderNotification(mirror.id).catch((err) =>
          console.error("Error encolando email al fotógrafo (pedido impresión):", err)
        );
      } else {
        queuePhotographerOrderNotification(orderId).catch((err) =>
          console.error("Error encolando email al fotógrafo (nuevo pedido, sin espejo impresión):", err)
        );
      }
    }
  } catch (err: unknown) {
    console.error("Error actualizando PrintOrder espejo (PAID):", err);
  }

  try {
    await prisma.webhookEvent.create({
      data: {
        paymentId: String(paymentId),
        status: "approved",
        orderId,
        orderType: "ALBUM_ORDER",
        externalRef: pay.external_reference ?? undefined,
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "P2002") throw err;
  }

  return { ok: true, applied: true, orderId, paymentId };
}
