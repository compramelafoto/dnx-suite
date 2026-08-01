import { randomUUID } from "node:crypto";
import {
  planEditionCheckoutFromSnapshot,
  type EditionCheckoutFinanceSnapshot,
  type PlannedEditionCheckout,
} from "../../../edition-checkout/index.js";
import type { DnxPaymentsPersistence } from "../../persistence/ports.js";
import type { PersistedProviderSplit } from "../../persistence/types.js";
import type { CurrencyCode } from "../../../contracts/primitives.js";

export function planRequiredEditionFinance(input: {
  snapshot: EditionCheckoutFinanceSnapshot;
  bridgeMode:
    | "manual"
    | "mercado_pago_test"
    | "mercado_pago_orders_test"
    | "mercado_pago_production";
  collectorAccessToken?: string;
}): PlannedEditionCheckout {
  const planned = planEditionCheckoutFromSnapshot(input.snapshot, {
    bridgeMode: input.bridgeMode,
  });
  const needsCollector =
    (input.bridgeMode === "mercado_pago_test" ||
      input.bridgeMode === "mercado_pago_production") &&
    planned.modality === "CHECKOUT_PRO_COLLECTOR_OAUTH";
  if (needsCollector && !input.collectorAccessToken) {
    throw new Error(
      "edition_finance_collector_token_required: falta OAuth del payment account beneficiario",
    );
  }
  return planned;
}

/** Recipient id estable por payment account (sin PII). */
export function recipientIdForPaymentAccount(paymentAccountId: string): string {
  const safe = paymentAccountId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return `dnx_recipient_pa_${safe || "unknown"}`;
}

export async function ensureRecipientsForEditionPlan(
  db: DnxPaymentsPersistence,
  planned: PlannedEditionCheckout,
): Promise<{ ownerRecipientId: string; recipientIds: string[] }> {
  const now = new Date().toISOString();
  const recipientIds: string[] = [];
  for (const a of planned.allocations) {
    const id = recipientIdForPaymentAccount(a.paymentAccountId);
    recipientIds.push(id);
    const existing = await db.recipients.findById(id);
    if (!existing) {
      await db.recipients.save({
        id,
        recipientType: a.role === "OWNER" ? "PLATFORM" : "ORGANIZER",
        status: "ACTIVE",
        displayReference: `pa:${a.paymentAccountId}`,
        ...(a.beneficiaryUserId != null ? { userId: a.beneficiaryUserId } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { ownerRecipientId: recipientIds[0]!, recipientIds };
}

export function buildSplitsFromEditionPlan(input: {
  providerOrderId: string;
  planned: PlannedEditionCheckout;
  currency: string;
  now: string;
  recipientIds: string[];
}): PersistedProviderSplit[] {
  return input.planned.allocations.map((a, i): PersistedProviderSplit => {
    const recipientId = input.recipientIds[i]!;
    const isOwner = i === 0;
    return {
      id: `split_ef_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      providerOrderId: input.providerOrderId,
      recipientId,
      providerReceiverReference: a.paymentAccountId,
      receiverType: isOwner ? "OWNER" : "PARTNER",
      amountMinor: BigInt(a.allocationAmountEstimated),
      percentageBps: a.basisPoints,
      currency: input.currency as CurrencyCode,
      description: `edition-finance:${a.role}:${a.basisPoints}bps`,
      status: "PLANNED",
      createdAt: input.now,
      updatedAt: input.now,
    };
  });
}

export function sanitizeEditionFinanceForOrderSnapshot(
  planned: PlannedEditionCheckout,
): Record<string, unknown> {
  return {
    schemaVersion: planned.snapshot.schemaVersion,
    agreementId: planned.snapshot.agreementId,
    distributionVersionId: planned.snapshot.distributionVersionId,
    distributionVersionNumber: planned.snapshot.distributionVersionNumber,
    modality: planned.modality,
    collectorPaymentAccountId: planned.collectorPaymentAccountId,
    currency: planned.snapshot.currency,
    grossAmount: planned.snapshot.grossAmount,
    discountAmount: planned.snapshot.discountAmount,
    chargedAmount: planned.snapshot.chargedAmount,
    providerFeeEstimated: planned.providerFeeEstimated,
    platformFee: planned.platformFee,
    distributableAmountEstimated: planned.distributableAmountEstimated,
    allocations: planned.allocations.map((a) => ({
      beneficiaryUserId: a.beneficiaryUserId,
      paymentAccountId: a.paymentAccountId,
      role: a.role,
      basisPoints: a.basisPoints,
      allocationAmountEstimated: a.allocationAmountEstimated,
      roundingAdjustment: a.roundingAdjustment,
      accountEnvironment: a.accountEnvironment,
      // sin tokens
    })),
  };
}
