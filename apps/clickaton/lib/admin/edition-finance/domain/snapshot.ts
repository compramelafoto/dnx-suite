import { buildMoneyBreakdown } from "./amounts";
import { allocateByLargestRemainder } from "./rounding";
import type {
  EditionFinancialDistributionView,
  OrderFinanceSnapshot,
} from "./types";
import type { EditionCheckoutFinanceSnapshot } from "@repo/payments/edition-checkout";

export function buildOrderFinanceSnapshot(input: {
  distribution: EditionFinancialDistributionView;
  currency: string;
  grossAmount: number;
  discountAmount: number;
  providerFee?: number;
  platformFee?: number;
  now?: Date;
}): OrderFinanceSnapshot {
  const money = buildMoneyBreakdown({
    currency: input.currency,
    grossAmount: input.grossAmount,
    discountAmount: input.discountAmount,
    providerFee: input.providerFee,
    platformFee: input.platformFee ?? 0,
  });

  const missingAccount = input.distribution.allocations.find((a) => !a.paymentConnectionId);
  if (missingAccount) {
    throw new Error(
      `snapshot_requires_payment_account:${missingAccount.beneficiaryDisplayName}`,
    );
  }

  const allocated = allocateByLargestRemainder(
    money.distributableAmount,
    input.distribution.allocations.map((a) => ({
      id: a.id,
      shareBps: a.shareBps,
      sortOrder: a.sortOrder,
    })),
  );
  const byId = new Map(allocated.map((a) => [a.id, a]));

  return {
    schemaVersion: 2,
    distributionId: input.distribution.id,
    agreementId: input.distribution.id,
    distributionVersionId: input.distribution.versionId ?? "",
    distributionVersion: input.distribution.version,
    distributionVersionNumber: input.distribution.version,
    currency: money.currency,
    grossAmount: money.grossAmount,
    discountAmount: money.discountAmount,
    chargedAmount: money.chargedAmount,
    providerFee: money.providerFee,
    providerFeeEstimated: money.providerFee,
    providerFeeConfirmed: null,
    platformFee: money.platformFee,
    distributableAmount: money.distributableAmount,
    feePolicy: input.distribution.feePolicy,
    roundingPolicy: input.distribution.roundingPolicy,
    allocations: input.distribution.allocations.map((a) => {
      const row = byId.get(a.id)!;
      const paymentAccountId = a.paymentConnectionId!;
      return {
        beneficiaryUserId: a.beneficiaryUserId,
        beneficiaryDisplayName: a.beneficiaryDisplayName,
        paymentConnectionId: paymentAccountId,
        paymentAccountId,
        paymentProvider: a.paymentConnection?.provider ?? "MERCADO_PAGO",
        accountEnvironment: a.paymentConnection?.environment ?? null,
        role: a.role,
        shareType: "PERCENTAGE" as const,
        shareValue: a.shareValue,
        shareBps: a.shareBps,
        basisPoints: a.shareBps,
        allocationAmount: row.allocationAmount,
        roundingAdjustment: row.roundingAdjustment,
      };
    }),
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

/** Adapta snapshot Clickatón → contrato edition-checkout de DNX Payments. */
export function toEditionCheckoutFinanceSnapshot(
  snapshot: OrderFinanceSnapshot,
): EditionCheckoutFinanceSnapshot {
  return {
    schemaVersion: 2,
    agreementId: snapshot.agreementId ?? snapshot.distributionId,
    distributionVersionId: snapshot.distributionVersionId,
    distributionVersionNumber:
      snapshot.distributionVersionNumber ?? snapshot.distributionVersion,
    currency: snapshot.currency,
    grossAmount: snapshot.grossAmount,
    discountAmount: snapshot.discountAmount,
    chargedAmount: snapshot.chargedAmount,
    providerFeeEstimated: snapshot.providerFeeEstimated ?? snapshot.providerFee,
    providerFeeConfirmed: snapshot.providerFeeConfirmed ?? null,
    platformFee: snapshot.platformFee,
    distributableAmount: snapshot.distributableAmount,
    feePolicy: snapshot.feePolicy,
    roundingPolicy: snapshot.roundingPolicy,
    allocations: snapshot.allocations.map((a) => {
      const paymentAccountId = a.paymentAccountId ?? a.paymentConnectionId;
      if (!paymentAccountId) {
        throw new Error("snapshot_allocation_missing_payment_account");
      }
      return {
        beneficiaryUserId: a.beneficiaryUserId,
        beneficiaryDisplayName: a.beneficiaryDisplayName,
        paymentAccountId,
        paymentProvider: a.paymentProvider ?? "MERCADO_PAGO",
        accountEnvironment: a.accountEnvironment ?? "TEST",
        role: a.role ?? "ORGANIZER",
        shareType: "PERCENTAGE" as const,
        shareValue: a.shareValue,
        basisPoints: a.basisPoints ?? a.shareBps,
        allocationAmount: a.allocationAmount,
        roundingAdjustment: a.roundingAdjustment,
      };
    }),
    createdAt: snapshot.createdAt,
  };
}
