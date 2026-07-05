import { OrderOrigin, OrderStatus, Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { revokeOrderDownloadTokens } from "@/lib/download-tokens";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { recalcPendingPayoutRequestsForReferrers } from "@/lib/referral/recalc-pending-payout-requests";
import { cancelOrganizerCommissionForOrder } from "@/lib/school-organizer-commission";
import { cancelEventOrganizerCommissionForOrder } from "@/lib/event-organizer-commission-snapshot";

export type AlbumOrderMpReversalAuditReason =
  | "REFUNDED"
  | "CHARGED_BACK"
  | "CANCELLED"
  | "REJECTED";

/**
 * Revierte un pedido de álbum que había quedado PAID: MP informa reembolso, contracargo o anulación
 * posterior. Idempotente si el pedido ya está REFUNDED/FAILED.
 */
export async function reverseAlbumOrderMercadoPagoIfWasPaid(params: {
  orderId: number;
  mpPaymentId: string;
  mpStatus: string;
  statusDetail?: string;
  auditReason: AlbumOrderMpReversalAuditReason;
}): Promise<{ applied: boolean; previousStatus: OrderStatus | null }> {
  const { orderId, mpPaymentId, mpStatus, statusDetail, auditReason } = params;

  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      albumId: true,
      origin: true,
      redemptionPaymentRefsJson: true,
      redemptionOrderId: true,
    },
  });
  if (!orderRow) {
    return { applied: false, previousStatus: null };
  }

  if (orderRow.status !== OrderStatus.PAID) {
    return { applied: false, previousStatus: orderRow.status };
  }

  const nextStatus =
    auditReason === "REFUNDED" || auditReason === "CHARGED_BACK"
      ? OrderStatus.REFUNDED
      : OrderStatus.FAILED;

  const reversalMeta = {
    at: new Date().toISOString(),
    mpPaymentId,
    mpStatus,
    statusDetail: statusDetail ?? null,
    auditReason,
  };

  let redemptionPatch: Prisma.InputJsonValue | undefined;
  if (orderRow.origin === OrderOrigin.PREVENTA_PACK) {
    const prev =
      orderRow.redemptionPaymentRefsJson &&
      typeof orderRow.redemptionPaymentRefsJson === "object" &&
      !Array.isArray(orderRow.redemptionPaymentRefsJson)
        ? (orderRow.redemptionPaymentRefsJson as Record<string, unknown>)
        : {};
    const reversals = [
      ...(Array.isArray((prev as { mpPaymentReversals?: unknown }).mpPaymentReversals)
        ? ((prev as { mpPaymentReversals: unknown[] }).mpPaymentReversals as unknown[])
        : []),
      reversalMeta,
    ];
    const postRedeemIncidents = Array.isArray(
      (prev as { postRedeemPaymentIncidents?: unknown }).postRedeemPaymentIncidents
    )
      ? [
          ...((prev as { postRedeemPaymentIncidents: unknown[] })
            .postRedeemPaymentIncidents as unknown[]),
        ]
      : [];
    if (orderRow.redemptionOrderId != null) {
      postRedeemIncidents.push({
        kind: "payment_reversed_after_redeem",
        at: reversalMeta.at,
        mpPaymentId,
        mpStatus,
        statusDetail: statusDetail ?? null,
        auditReason,
        redemptionOrderId: orderRow.redemptionOrderId,
      });
    }
    redemptionPatch = {
      ...prev,
      mpPaymentReversals: reversals,
      postRedeemPaymentIncidents: postRedeemIncidents,
    } as Prisma.InputJsonValue;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      mpPaymentId,
      ...(redemptionPatch !== undefined ? { redemptionPaymentRefsJson: redemptionPatch } : {}),
    },
  });

  try {
    await revokeOrderDownloadTokens(orderId);
  } catch (err: unknown) {
    console.error("reverseAlbumOrder: revokeOrderDownloadTokens", err);
  }

  try {
    const tag = `ALBUM_ORDER:${orderId}`;
    await prisma.printOrder.updateMany({
      where: { tags: { has: tag } },
      data: {
        paymentStatus: nextStatus === OrderStatus.REFUNDED ? "REFUNDED" : "FAILED",
        mpPaymentId: String(mpPaymentId),
        statusUpdatedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    console.error("reverseAlbumOrder: printOrder mirror", err);
  }

  try {
    await prisma.referralEarning.updateMany({
      where: { saleRef: `ALBUM_ORDER:${orderId}` },
      data: { reversedAt: new Date() },
    });
    const reversed = await prisma.referralEarning.findMany({
      where: { saleRef: `ALBUM_ORDER:${orderId}` },
      select: { attributionId: true },
    });
    if (reversed.length > 0) {
      const attrs = await prisma.referralAttribution.findMany({
        where: { id: { in: reversed.map((r) => r.attributionId) } },
        select: { referrerUserId: true },
      });
      await recalcPendingPayoutRequestsForReferrers(attrs.map((a) => a.referrerUserId));
    }
  } catch (err: unknown) {
    console.error("reverseAlbumOrder: referral reverse", err);
  }

  try {
    await cancelOrganizerCommissionForOrder(orderId);
  } catch (err: unknown) {
    console.error("reverseAlbumOrder: organizer commission reverse", err);
  }

  try {
    await cancelEventOrganizerCommissionForOrder(orderId);
  } catch (err: unknown) {
    console.error("reverseAlbumOrder: event organizer commission reverse", err);
  }

  const eventType =
    auditReason === "REFUNDED"
      ? "PAYMENT_REFUNDED"
      : auditReason === "CHARGED_BACK"
        ? "PAYMENT_CHARGED_BACK"
        : "PAYMENT_REJECTED";

  await registerAuditEvent({
    targetOrderType: "ALBUM_ORDER",
    targetOrderId: orderId,
    targetAlbumId: orderRow.albumId,
    eventType,
    metadata: {
      mpPaymentId,
      mpStatus,
      statusDetail: statusDetail ?? null,
      auditReason,
      origin: orderRow.origin,
    },
  });

  if (
    orderRow.origin === OrderOrigin.PREVENTA_PACK &&
    orderRow.redemptionOrderId != null
  ) {
    await registerAuditEvent({
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: orderId,
      targetAlbumId: orderRow.albumId,
      eventType: "PAYMENT_REVERSED_AFTER_REDEEM",
      metadata: {
        mpPaymentId,
        mpStatus,
        statusDetail: statusDetail ?? null,
        auditReason,
        redemptionOrderId: orderRow.redemptionOrderId,
        message:
          "Pago del pack preventa revertido en MP después del canje; el pedido de canje se conserva para trazabilidad",
      },
    });
  }

  console.info("[MP] reverseAlbumOrderMercadoPagoIfWasPaid", {
    orderId,
    mpPaymentId,
    previousStatus: orderRow.status,
    nextStatus,
    auditReason,
    origin: orderRow.origin,
  });

  return { applied: true, previousStatus: orderRow.status };
}
