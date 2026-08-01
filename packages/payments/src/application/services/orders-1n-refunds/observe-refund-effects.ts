import type { AppendOnlyLedger } from "../../../ledger/index.js";
import type { RefundStore } from "./store.js";
import { getRefundableAmount } from "./remaining.js";
import type { PersistedRefundRecord } from "./types.js";

/**
 * Apply idempotent post-refund webhook effects.
 * Does NOT create a new refund from webhook alone (avoid double ledger).
 * Marks attention when provider says refunded but local store empty.
 */
export function applyOrdersRefundWebhookEffects(input: {
  providerOrderId: string;
  paymentOrderId: string;
  providerStatus: string;
  statusDetail?: string | null;
  orderTotalMinor: bigint;
  currency: PersistedRefundRecord["currency"];
  store: RefundStore;
  ledger?: AppendOnlyLedger;
}): Promise<{
  outcome: "noop" | "acknowledged" | "attention";
  remainingMinor: bigint;
  duplicateSafe: true;
  detail: string;
}> {
  return (async () => {
    const local = await input.store.listByProviderOrderId(input.providerOrderId);
    const balance = getRefundableAmount({
      paymentOrderId: input.paymentOrderId,
      orderTotalMinor: input.orderTotalMinor,
      currency: input.currency,
      refunds: local,
    });

    const status = input.providerStatus.toUpperCase();
    const detail = (input.statusDetail ?? "").toLowerCase();
    const isRefundSignal =
      status === "REFUNDED" ||
      status === "PARTIALLY_REFUNDED" ||
      detail === "partially_refunded" ||
      detail === "refunded";

    if (!isRefundSignal) {
      return {
        outcome: "noop" as const,
        remainingMinor: balance.remainingMinor,
        duplicateSafe: true as const,
        detail: "not_a_refund_signal",
      };
    }

    if (local.length === 0) {
      return {
        outcome: "attention" as const,
        remainingMinor: balance.remainingMinor,
        duplicateSafe: true as const,
        detail: "provider_refund_without_local_refund_record",
      };
    }

    // Ledger already posted at create time — webhook must not duplicate.
    void input.ledger;

    return {
      outcome: "acknowledged" as const,
      remainingMinor: balance.remainingMinor,
      duplicateSafe: true as const,
      detail: `local_refunds=${local.length}`,
    };
  })();
}
