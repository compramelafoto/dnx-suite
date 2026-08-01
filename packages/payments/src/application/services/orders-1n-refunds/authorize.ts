import type { RefundActorContext } from "./types.js";

export class RefundAuthorizationError extends Error {
  readonly code = "REFUND_UNAUTHORIZED";
  constructor(message: string) {
    super(message);
    this.name = "RefundAuthorizationError";
  }
}

/**
 * Server-side authorization for refund requests.
 * Does not accept arbitrary paymentOrderId from untrusted consumers.
 */
export function assertRefundAuthorized(input: {
  paymentOrderId: string;
  actor: RefundActorContext;
}): void {
  if (!input.paymentOrderId.trim()) {
    throw new RefundAuthorizationError("paymentOrderId required");
  }
  if (!input.actor.actorId?.trim()) {
    throw new RefundAuthorizationError("actor.actorId required");
  }
  if (input.actor.trustedService) {
    return;
  }
  const allowed = input.actor.authorizedPaymentOrderIds ?? [];
  if (!allowed.includes(input.paymentOrderId)) {
    throw new RefundAuthorizationError(
      "paymentOrderId is not authorized for this actor",
    );
  }
}

export function assertOrderRefundableStatus(status: string): void {
  const s = status.trim().toUpperCase();
  const ok = new Set([
    "PAID",
    "CAPTURED",
    "PARTIALLY_REFUNDED",
    "PROCESSED",
    "PROCESSED_ACCREDITED",
    "APPROVED",
  ]);
  if (!ok.has(s)) {
    throw Object.assign(new Error(`ORDER_NOT_REFUNDABLE:${s}`), {
      code: "ORDER_NOT_REFUNDABLE",
    });
  }
}
