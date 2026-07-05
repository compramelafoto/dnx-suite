import { CheckoutPaymentSource, OrderOrigin, OrderStatus, Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getPaymentById, type PaymentInfo, type PaymentStatus } from "@/lib/mercadopago";
import {
  reverseAlbumOrderMercadoPagoIfWasPaid,
  type AlbumOrderMpReversalAuditReason,
} from "@/lib/mercadopago/reverse-album-order-mercado-pago";
import { registerAuditEvent } from "@/lib/antifraud/audit";

export type PreventaPackRedeemBlockCode =
  | "ORDER_NOT_FOUND"
  | "NOT_PREVENTA_PACK"
  | "NOT_PAID"
  | "ALREADY_REDEEMED"
  | "PAYMENT_NO_LONGER_VALID"
  | "MP_UNAVAILABLE";

function mpStatusToReversalReason(st: PaymentStatus): AlbumOrderMpReversalAuditReason {
  if (st === "refunded") return "REFUNDED";
  if (st === "charged_back") return "CHARGED_BACK";
  if (st === "cancelled") return "CANCELLED";
  return "REJECTED";
}

function mergeRedemptionRefs(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const prev =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...prev, ...patch } as Prisma.InputJsonValue;
}

/**
 * Validación central antes de canjear un Order PREVENTA_PACK:
 * estado local + verificación en vivo contra Mercado Pago cuando hay mpPaymentId.
 * Si MP ya no está approved, aplica la misma reversión que el webhook y bloquea el canje.
 */
export async function assertPreventaPackOrderRedeemable(orderId: number): Promise<
  | { ok: true }
  | { ok: false; code: PreventaPackRedeemBlockCode; message: string; httpStatus: number }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      origin: true,
      status: true,
      mpPaymentId: true,
      redemptionOrderId: true,
      albumId: true,
      checkoutPaymentSource: true,
    },
  });

  if (!order) {
    return {
      ok: false,
      code: "ORDER_NOT_FOUND",
      message: "Pedido no encontrado",
      httpStatus: 404,
    };
  }

  if (order.origin !== OrderOrigin.PREVENTA_PACK) {
    return {
      ok: false,
      code: "NOT_PREVENTA_PACK",
      message: "Este pedido no es un pack de preventa canjeable",
      httpStatus: 400,
    };
  }

  if (order.redemptionOrderId != null) {
    return {
      ok: false,
      code: "ALREADY_REDEEMED",
      message: "Este pack ya fue canjeado",
      httpStatus: 409,
    };
  }

  if (order.status !== OrderStatus.PAID) {
    if (order.status === OrderStatus.REFUNDED) {
      return {
        ok: false,
        code: "NOT_PAID",
        message:
          "Este pack ya no está disponible: el pago fue reembolsado o anulado. Si creés que es un error, contactá al fotógrafo.",
        httpStatus: 409,
      };
    }
    if (order.status === OrderStatus.FAILED || order.status === OrderStatus.CANCELED) {
      return {
        ok: false,
        code: "NOT_PAID",
        message: "El pedido de preventa no está pagado o fue cancelado.",
        httpStatus: 400,
      };
    }
    return {
      ok: false,
      code: "NOT_PAID",
      message: "El pedido debe estar pagado para canjear el pack.",
      httpStatus: 400,
    };
  }

  const noMpCheck =
    !order.mpPaymentId ||
    order.checkoutPaymentSource === CheckoutPaymentSource.PREPAID_PACK ||
    order.mpPaymentId.trim() === "";

  if (noMpCheck) {
    return { ok: true };
  }

  let accessTokenOverride: string | undefined;
  const album = await prisma.album.findUnique({
    where: { id: order.albumId },
    select: { userId: true },
  });
  if (album?.userId) {
    const u = await prisma.user.findUnique({
      where: { id: album.userId },
      select: { mpAccessToken: true },
    });
    accessTokenOverride = u?.mpAccessToken ?? undefined;
  }

  let pay: PaymentInfo;
  try {
    pay = await getPaymentById(String(order.mpPaymentId), { accessTokenOverride });
  } catch (firstErr) {
    try {
      pay = await getPaymentById(String(order.mpPaymentId), {});
    } catch {
      console.error("[assertPreventaPackOrderRedeemable] getPaymentById failed", orderId, firstErr);
      return {
        ok: false,
        code: "MP_UNAVAILABLE",
        message:
          "No pudimos verificar el pago con Mercado Pago en este momento. Reintentá en unos minutos o contactá soporte.",
        httpStatus: 503,
      };
    }
  }

  if (pay.status === "approved") {
    return { ok: true };
  }

  const auditReason = mpStatusToReversalReason(pay.status);
  await reverseAlbumOrderMercadoPagoIfWasPaid({
    orderId,
    mpPaymentId: pay.id,
    mpStatus: pay.status,
    statusDetail: pay.status_detail,
    auditReason,
  });

  const refreshed = await prisma.order.findUnique({
    where: { id: orderId },
    select: { redemptionPaymentRefsJson: true },
  });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      redemptionPaymentRefsJson: mergeRedemptionRefs(refreshed?.redemptionPaymentRefsJson, {
        redeemGateMpCheckAt: new Date().toISOString(),
        redeemGateMpStatus: pay.status,
      }),
    },
  });

  await registerAuditEvent({
    targetOrderType: "ALBUM_ORDER",
    targetOrderId: orderId,
    targetAlbumId: order.albumId,
    eventType: "REDEEM_BLOCKED_STALE_PAYMENT",
    metadata: {
      mpPaymentId: pay.id,
      mpStatus: pay.status,
      statusDetail: pay.status_detail,
      message: "Canje bloqueado: estado del pago en MP ya no es approved",
    },
  });

  return {
    ok: false,
    code: "PAYMENT_NO_LONGER_VALID",
    message:
      "Este pack ya no se puede canjear: Mercado Pago informa que el pago fue anulado, reembolsado o rechazado. Si ya pagaste, contactá al fotógrafo.",
    httpStatus: 409,
  };
}
