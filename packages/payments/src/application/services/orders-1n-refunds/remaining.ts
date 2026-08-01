import type { CurrencyCode } from "../../../contracts/primitives.js";
import type { PersistedRefundRecord, RefundableBalance } from "./types.js";

const SUCCESS_STATUSES = new Set(["PROCESSED", "SUBMITTED", "REQUESTED"]);

/**
 * Sum successful / in-flight refunds against remaining capacity.
 * REQUESTED/SUBMITTED count toward remaining to prevent double-spend races.
 */
export function sumRefundedMinor(refunds: readonly PersistedRefundRecord[]): bigint {
  let total = 0n;
  for (const r of refunds) {
    if (r.status === "FAILED" || r.status === "CANCELED") continue;
    if (SUCCESS_STATUSES.has(r.status) || r.status === "PROCESSED") {
      total += r.amountMinor;
    }
  }
  return total;
}

export function getRefundableAmount(input: {
  paymentOrderId: string;
  orderTotalMinor: bigint;
  currency: CurrencyCode;
  refunds: readonly PersistedRefundRecord[];
}): RefundableBalance {
  if (input.orderTotalMinor < 0n) {
    throw new Error("orderTotalMinor must be >= 0");
  }
  const refundedMinor = sumRefundedMinor(input.refunds);
  const remainingMinor =
    refundedMinor >= input.orderTotalMinor
      ? 0n
      : input.orderTotalMinor - refundedMinor;
  return {
    paymentOrderId: input.paymentOrderId,
    orderTotalMinor: input.orderTotalMinor,
    refundedMinor,
    remainingMinor,
    currency: input.currency,
    fullyRefunded: remainingMinor === 0n && input.orderTotalMinor > 0n,
  };
}

export function resolveRefundAmountMinor(input: {
  requestedAmountMinor: bigint | undefined;
  remainingMinor: bigint;
}): bigint {
  if (input.requestedAmountMinor === undefined) {
    if (input.remainingMinor <= 0n) {
      throw Object.assign(new Error("ORDER_FULLY_REFUNDED"), {
        code: "ORDER_FULLY_REFUNDED",
      });
    }
    return input.remainingMinor;
  }
  if (input.requestedAmountMinor <= 0n) {
    throw Object.assign(new Error("INVALID_REFUND_AMOUNT"), {
      code: "INVALID_REFUND_AMOUNT",
    });
  }
  if (input.requestedAmountMinor > input.remainingMinor) {
    throw Object.assign(new Error("REFUND_AMOUNT_EXCEEDS_REMAINING"), {
      code: "REFUND_AMOUNT_EXCEEDS_REMAINING",
    });
  }
  return input.requestedAmountMinor;
}
