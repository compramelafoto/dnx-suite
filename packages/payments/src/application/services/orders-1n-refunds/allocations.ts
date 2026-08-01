import type { RefundAllocation, RefundAllocationShare } from "./types.js";
import { REFUND_ALLOCATION_STRATEGY } from "./types.js";

export class RefundAllocationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RefundAllocationError";
    this.code = code;
  }
}

/**
 * Reverse a refund amount across original split shares.
 *
 * Strategy: PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER
 * MP Orders refund response does not expose per-receiver breakdown —
 * we persist this deterministic internal evidence.
 *
 * Guarantees: sum(allocations) === refundAmountMinor
 */
export function allocateRefundProportionally(input: {
  refundAmountMinor: bigint;
  originalAllocations: RefundAllocationShare[];
}): { allocations: RefundAllocation[]; strategy: typeof REFUND_ALLOCATION_STRATEGY } {
  const refund = input.refundAmountMinor;
  if (refund <= 0n) {
    throw new RefundAllocationError("INVALID_AMOUNT", "refund amount must be > 0");
  }
  const originals = input.originalAllocations.filter((a) => a.amountMinor > 0n);
  if (originals.length === 0) {
    throw new RefundAllocationError(
      "NO_ALLOCATIONS",
      "originalAllocations required for refund reversal",
    );
  }

  const originalTotal = originals.reduce((s, a) => s + a.amountMinor, 0n);
  if (originalTotal <= 0n) {
    throw new RefundAllocationError("INVALID_ORIGINAL_TOTAL", "original total must be > 0");
  }
  if (refund > originalTotal) {
    throw new RefundAllocationError(
      "REFUND_EXCEEDS_ORIGINAL",
      "refund cannot exceed original allocation total",
    );
  }

  // Floor proportional shares
  const floors = originals.map((a) => {
    const product = refund * a.amountMinor;
    const floor = product / originalTotal;
    const remainderWeight = product % originalTotal;
    return {
      recipientId: a.recipientId,
      role: a.role,
      floor,
      remainderWeight,
    };
  });

  let allocated = floors.reduce((s, f) => s + f.floor, 0n);
  let remainder = refund - allocated;

  const ordered = [...floors].sort((a, b) => {
    if (a.remainderWeight !== b.remainderWeight) {
      return a.remainderWeight > b.remainderWeight ? -1 : 1;
    }
    return a.recipientId.localeCompare(b.recipientId);
  });

  const amounts = new Map<string, bigint>();
  for (const f of floors) {
    amounts.set(f.recipientId, f.floor);
  }
  for (const f of ordered) {
    if (remainder <= 0n) break;
    amounts.set(f.recipientId, (amounts.get(f.recipientId) ?? 0n) + 1n);
    remainder -= 1n;
  }
  if (remainder !== 0n) {
    throw new RefundAllocationError(
      "ROUNDING_FAILED",
      `remainder not allocated: ${remainder}`,
    );
  }

  const allocations: RefundAllocation[] = originals.map((a) => ({
    recipientId: a.recipientId,
    role: a.role,
    amountMinor: amounts.get(a.recipientId) ?? 0n,
  }));

  const sum = allocations.reduce((s, a) => s + a.amountMinor, 0n);
  if (sum !== refund) {
    throw new RefundAllocationError(
      "SUM_MISMATCH",
      `allocation sum ${sum} != refund ${refund}`,
    );
  }

  return { allocations, strategy: REFUND_ALLOCATION_STRATEGY };
}
