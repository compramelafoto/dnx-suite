import { randomUUID } from "node:crypto";
import {
  AppendOnlyLedger,
  createLedgerEntry,
} from "../../../ledger/index.js";
import type { CurrencyCode } from "../../../contracts/primitives.js";
import type { RefundAllocation } from "./types.js";

/**
 * Post REFUND + REFUND_ALLOCATION compensating entries.
 * Duplicate (causeType, causeId, purpose) is rejected by AppendOnlyLedger.
 */
export function postRefundLedgerEntries(input: {
  ledger: AppendOnlyLedger;
  refundId: string;
  paymentOrderId: string;
  currency: CurrencyCode;
  refundAmountMinor: bigint;
  allocations: RefundAllocation[];
  postedAt?: string;
}): void {
  const postedAt = input.postedAt ?? new Date().toISOString();
  const journalId = `jr_refund_${input.refundId}`;

  // REFUND: debit refunds clearing, credit payments clearing (compensating capture)
  input.ledger.append(
    createLedgerEntry({
      id: `le_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      journalId,
      currency: input.currency,
      legs: [
        {
          accountId: `acct:refunds:${input.paymentOrderId}`,
          amountMinor: input.refundAmountMinor,
        },
        {
          accountId: `acct:payments:${input.paymentOrderId}`,
          amountMinor: -input.refundAmountMinor,
        },
      ],
      causeType: "RefundProcessed",
      causeId: input.refundId,
      purpose: "refund",
      postedAt,
      metadata: { paymentOrderId: input.paymentOrderId },
    }),
  );

  for (const alloc of input.allocations) {
    if (alloc.amountMinor <= 0n) continue;
    input.ledger.append(
      createLedgerEntry({
        id: `le_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        journalId: `${journalId}_${alloc.recipientId}`,
        currency: input.currency,
        legs: [
          {
            accountId: `acct:recipient:${alloc.recipientId}`,
            amountMinor: -alloc.amountMinor,
          },
          {
            accountId: `acct:allocation_reversal:${input.paymentOrderId}`,
            amountMinor: alloc.amountMinor,
          },
        ],
        causeType: "RefundAllocation",
        causeId: input.refundId,
        purpose: `refund_allocation:${alloc.recipientId}`,
        postedAt,
        metadata: {
          recipientId: alloc.recipientId,
          role: alloc.role,
        },
      }),
    );
  }
}
