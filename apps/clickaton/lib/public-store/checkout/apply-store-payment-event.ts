import "server-only";

import { Prisma, prisma } from "@repo/db";
import type { NormalizedPaymentEvent } from "@/lib/checkout/domain/types";
import { mapDnxStatusToClickatonEffect } from "@/lib/checkout/domain/mapping";
import { getDnxPaymentsClient } from "@/lib/checkout/actions/runtime";
import { assertStoreOrderTransition, assertStorePaymentTransition } from "./transitions";
import {
  captureStoreHoldsForOrder,
  releaseStoreHoldsForOrder,
} from "./hold-operations";
import { logStoreCheckoutEvent } from "./observability";
import type { StoreOrderPaymentStatus, StoreOrderStatus } from "./types";
export { isStoreOrderPaymentSource } from "./payment-source";

function mapPaymentStatus(status: string): StoreOrderPaymentStatus {
  switch (status) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "CANCELLED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    case "CHARGEBACK":
      return "CHARGED_BACK";
    case "PENDING":
    case "PROCESSING":
    case "CREATED":
      return "PENDING";
    default:
      return "UNKNOWN";
  }
}

export type ApplyStorePaymentResult = {
  applied: boolean;
  duplicate: boolean;
  conflict: boolean;
  conflictCode?: string;
  publicId: string;
  orderStatus: StoreOrderStatus;
  paymentStatus: StoreOrderPaymentStatus;
};

/**
 * Efectos de pago TIENDA. Idempotente. No confía en redirect del browser.
 */
export async function applyStorePaymentEvent(
  event: NormalizedPaymentEvent,
): Promise<ApplyStorePaymentResult> {
  const payments = getDnxPaymentsClient();
  let order;
  try {
    order = await payments.applyVerifiedEvent(event);
  } catch (err) {
    logStoreCheckoutEvent("store_checkout_failed", {
      code: "WEBHOOK_APPLY",
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      publicId: event.sourceId,
    });
    return {
      applied: false,
      duplicate: false,
      conflict: true,
      conflictCode: "PAYMENT_APPLY_FAILED",
      publicId: event.sourceId,
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: "UNKNOWN",
    };
  }

  if (!order) {
    return {
      applied: false,
      duplicate: false,
      conflict: true,
      conflictCode: "PAYMENT_ORDER_NOT_FOUND",
      publicId: event.sourceId,
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: "UNKNOWN",
    };
  }

  const storeOrder = await prisma.clickatonStoreOrder.findUnique({
    where: { publicId: event.sourceId },
  });
  if (!storeOrder) {
    return {
      applied: false,
      duplicate: false,
      conflict: true,
      conflictCode: "STORE_ORDER_NOT_FOUND",
      publicId: event.sourceId,
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: "UNKNOWN",
    };
  }

  if (
    storeOrder.status === "PAID" &&
    storeOrder.paymentStatus === "APPROVED" &&
    order.status === "APPROVED"
  ) {
    logStoreCheckoutEvent("store_webhook_duplicate", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
      paymentOrderId: order.id,
    });
    return {
      applied: false,
      duplicate: true,
      conflict: false,
      publicId: storeOrder.publicId,
      orderStatus: storeOrder.status,
      paymentStatus: storeOrder.paymentStatus,
    };
  }

  if (order.amountMinor !== storeOrder.totalAmount) {
    logStoreCheckoutEvent("store_checkout_failed", {
      code: "AMOUNT_MISMATCH",
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
    });
    return {
      applied: false,
      duplicate: false,
      conflict: true,
      conflictCode: "PAYMENT_AMOUNT_MISMATCH",
      publicId: storeOrder.publicId,
      orderStatus: storeOrder.status,
      paymentStatus: storeOrder.paymentStatus,
    };
  }

  const effect = mapDnxStatusToClickatonEffect(order.status);
  const nextPay = mapPaymentStatus(order.status);

  if (effect.holds === "confirm") {
    try {
      await prisma.$transaction(
        async (tx) => {
          const current = await tx.clickatonStoreOrder.findUniqueOrThrow({
            where: { id: storeOrder.id },
          });
          if (current.status === "PAID" && current.paymentStatus === "APPROVED") {
            return;
          }
          assertStoreOrderTransition(current.status, "PAID");
          assertStorePaymentTransition(current.paymentStatus, "APPROVED");
          await captureStoreHoldsForOrder(tx, current.id);
          await tx.clickatonStoreOrder.update({
            where: { id: current.id },
            data: {
              status: "PAID",
              paymentStatus: "APPROVED",
              paymentOrderId: order.id,
              paymentExternalReference: order.externalReference,
              paymentProvider: order.provider,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      logStoreCheckoutEvent("store_checkout_failed", {
        code: "CAPTURE_FAILED",
        orderId: storeOrder.id,
        publicId: storeOrder.publicId,
        reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      });
      return {
        applied: false,
        duplicate: false,
        conflict: true,
        conflictCode: "CAPTURE_FAILED",
        publicId: storeOrder.publicId,
        orderStatus: storeOrder.status,
        paymentStatus: storeOrder.paymentStatus,
      };
    }

    logStoreCheckoutEvent("store_payment_approved", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
      paymentOrderId: order.id,
    });
    logStoreCheckoutEvent("store_hold_captured", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
    });
    logStoreCheckoutEvent("store_webhook_processed", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
      transition: "PAID",
    });

    return {
      applied: true,
      duplicate: false,
      conflict: false,
      publicId: storeOrder.publicId,
      orderStatus: "PAID",
      paymentStatus: "APPROVED",
    };
  }

  if (effect.holds === "release_via_expire") {
    await prisma.$transaction(async (tx) => {
      const current = await tx.clickatonStoreOrder.findUniqueOrThrow({
        where: { id: storeOrder.id },
      });
      if (current.status === "PAID") return;
      await releaseStoreHoldsForOrder(tx, {
        orderId: current.id,
        reason: "RELEASED",
      });
      const nextStatus: StoreOrderStatus =
        order.status === "CANCELLED" ? "CANCELLED" : "PAYMENT_FAILED";
      assertStoreOrderTransition(current.status, nextStatus);
      await tx.clickatonStoreOrder.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          paymentStatus: nextPay,
        },
      });
    });

    logStoreCheckoutEvent("store_payment_rejected", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
      paymentStatus: nextPay,
    });
    logStoreCheckoutEvent("store_hold_released", {
      orderId: storeOrder.id,
      publicId: storeOrder.publicId,
    });

    return {
      applied: true,
      duplicate: false,
      conflict: false,
      publicId: storeOrder.publicId,
      orderStatus:
        order.status === "CANCELLED" ? "CANCELLED" : "PAYMENT_FAILED",
      paymentStatus: nextPay,
    };
  }

  await prisma.clickatonStoreOrder.update({
    where: { id: storeOrder.id },
    data: {
      paymentStatus: nextPay,
      paymentOrderId: order.id,
      paymentExternalReference: order.externalReference,
      paymentProvider: order.provider,
    },
  });

  logStoreCheckoutEvent("store_webhook_processed", {
    orderId: storeOrder.id,
    publicId: storeOrder.publicId,
    paymentStatus: nextPay,
  });

  return {
    applied: true,
    duplicate: false,
    conflict: false,
    publicId: storeOrder.publicId,
    orderStatus: storeOrder.status,
    paymentStatus: nextPay,
  };
}
