import type { PaymentEnvironment } from "../../../contracts/primitives.js";
import type { PaymentProvider } from "../../../providers/types.js";
import type { RefundStore } from "./store.js";
import type { PersistedRefundRecord } from "./types.js";
import { getRefundableAmount } from "./remaining.js";

export type ReconcileMercadoPagoOrderRefundsInput = {
  providerOrderId: string;
  paymentOrderId: string;
  orderTotalMinor: bigint;
  currency: PersistedRefundRecord["currency"];
  environment: PaymentEnvironment;
  provider: Pick<PaymentProvider, "getOrder">;
  store: RefundStore;
};

export type ReconcileMercadoPagoOrderRefundsResult = {
  providerOrderId: string;
  providerStatus: string;
  statusDetail: string | null;
  localRefundCount: number;
  remainingMinor: bigint;
  fullyRefunded: boolean;
  needsAttention: boolean;
  notes: string[];
};

/**
 * Contingency: GET Order + compare with local refund store.
 * Does not invent refunds from webhook alone — uses provider as source of truth for status.
 */
export async function reconcileMercadoPagoOrderRefunds(
  input: ReconcileMercadoPagoOrderRefundsInput,
): Promise<ReconcileMercadoPagoOrderRefundsResult> {
  const notes: string[] = [];
  const got = await input.provider.getOrder(
    input.providerOrderId,
    input.environment,
  );
  const local = await input.store.listByProviderOrderId(input.providerOrderId);
  const balance = getRefundableAmount({
    paymentOrderId: input.paymentOrderId,
    orderTotalMinor: input.orderTotalMinor,
    currency: input.currency,
    refunds: local,
  });

  const status = got.status.toUpperCase();
  const detail = (got.statusDetail ?? "").toLowerCase();

  if (status === "REFUNDED" && !balance.fullyRefunded) {
    notes.push("provider_fully_refunded_local_remaining_positive");
  }
  if (
    (status === "PARTIALLY_REFUNDED" || detail === "partially_refunded") &&
    balance.remainingMinor === 0n
  ) {
    notes.push("provider_partial_but_local_fully_refunded");
  }
  if (status.includes("UNKNOWN")) {
    notes.push("provider_status_unknown");
  }

  return {
    providerOrderId: got.providerOrderId,
    providerStatus: got.status,
    statusDetail: got.statusDetail ?? null,
    localRefundCount: local.length,
    remainingMinor: balance.remainingMinor,
    fullyRefunded: balance.fullyRefunded,
    needsAttention: notes.length > 0,
    notes,
  };
}
