import {
  EDITION_CHECKOUT_BPS_TOTAL,
  type EditionCheckoutFinanceSnapshot,
  type PlannedEditionAllocation,
  type PlannedEditionCheckout,
} from "./types.js";

export class EditionCheckoutAllocationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EditionCheckoutAllocationError";
  }
}

/**
 * LARGEST_REMAINDER determinístico sobre basis points.
 * Suma de allocations = distributableAmount exactamente.
 */
export function allocateByBasisPoints(
  distributableAmount: number,
  rows: Array<{ id: string; basisPoints: number; sortOrder: number }>,
): Array<{ id: string; basisPoints: number; allocationAmount: number; roundingAdjustment: number }> {
  if (!Number.isInteger(distributableAmount) || distributableAmount < 0) {
    throw new EditionCheckoutAllocationError(
      "INVALID_DISTRIBUTABLE",
      "distributableAmount must be a non-negative integer",
    );
  }
  const totalBps = rows.reduce((s, r) => s + r.basisPoints, 0);
  if (totalBps !== EDITION_CHECKOUT_BPS_TOTAL) {
    throw new EditionCheckoutAllocationError(
      "BPS_SUM",
      `basisPoints must sum to ${EDITION_CHECKOUT_BPS_TOTAL}, got ${totalBps}`,
    );
  }
  if (rows.length === 0) {
    throw new EditionCheckoutAllocationError("EMPTY", "at least one allocation required");
  }

  const base = rows.map((r) => {
    const exact = (distributableAmount * r.basisPoints) / EDITION_CHECKOUT_BPS_TOTAL;
    const floor = Math.floor(exact);
    return {
      id: r.id,
      basisPoints: r.basisPoints,
      sortOrder: r.sortOrder,
      floor,
      remainder: exact - floor,
    };
  });

  let leftover = distributableAmount - base.reduce((s, b) => s + b.floor, 0);
  const ranked = [...base].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
  const bonus = new Map<string, number>();
  for (const row of ranked) {
    if (leftover <= 0) break;
    bonus.set(row.id, (bonus.get(row.id) ?? 0) + 1);
    leftover -= 1;
  }

  return base.map((b) => {
    const adj = bonus.get(b.id) ?? 0;
    return {
      id: b.id,
      basisPoints: b.basisPoints,
      allocationAmount: b.floor + adj,
      roundingAdjustment: adj,
    };
  });
}

export function validateEditionCheckoutSnapshot(
  snapshot: EditionCheckoutFinanceSnapshot,
): void {
  if (snapshot.schemaVersion !== 2) {
    throw new EditionCheckoutAllocationError(
      "SNAPSHOT_VERSION",
      `unsupported snapshot schemaVersion: ${String(snapshot.schemaVersion)}`,
    );
  }
  if (!snapshot.agreementId || !snapshot.distributionVersionId) {
    throw new EditionCheckoutAllocationError(
      "SNAPSHOT_INCOMPLETE",
      "agreementId and distributionVersionId are required",
    );
  }
  if (!Array.isArray(snapshot.allocations) || snapshot.allocations.length === 0) {
    throw new EditionCheckoutAllocationError("SNAPSHOT_EMPTY", "snapshot has no allocations");
  }
  const bps = snapshot.allocations.reduce((s, a) => s + a.basisPoints, 0);
  if (bps !== EDITION_CHECKOUT_BPS_TOTAL) {
    throw new EditionCheckoutAllocationError(
      "BPS_SUM",
      `snapshot basisPoints must sum to ${EDITION_CHECKOUT_BPS_TOTAL}, got ${bps}`,
    );
  }
  for (const a of snapshot.allocations) {
    if (!a.paymentAccountId) {
      throw new EditionCheckoutAllocationError(
        "MISSING_PAYMENT_ACCOUNT",
        `allocation missing paymentAccountId (${a.beneficiaryDisplayName})`,
      );
    }
    if (a.allocationAmount < 0 || a.basisPoints < 0) {
      throw new EditionCheckoutAllocationError(
        "NEGATIVE",
        "allocation amounts/bps must be non-negative",
      );
    }
  }
  const charged = snapshot.chargedAmount;
  const expectedDistributable =
    charged - snapshot.providerFeeEstimated - snapshot.platformFee;
  if (snapshot.distributableAmount !== expectedDistributable) {
    throw new EditionCheckoutAllocationError(
      "DISTRIBUTABLE_MISMATCH",
      `distributableAmount ${snapshot.distributableAmount} != charged - fees ${expectedDistributable}`,
    );
  }
  const sumAlloc = snapshot.allocations.reduce((s, a) => s + a.allocationAmount, 0);
  if (sumAlloc !== snapshot.distributableAmount) {
    throw new EditionCheckoutAllocationError(
      "ALLOCATION_SUM",
      `allocation sum ${sumAlloc} != distributable ${snapshot.distributableAmount}`,
    );
  }
}

/**
 * Planifica checkout desde snapshot (no lee config activa).
 * N=1 → Checkout Pro collector OAuth del beneficiario.
 * N>1 → modalidad ORDERS_1N_SPLIT documentada (no se simula en Preferences).
 */
export function planEditionCheckoutFromSnapshot(
  snapshot: EditionCheckoutFinanceSnapshot,
  opts?: {
    bridgeMode?:
      | "manual"
      | "mercado_pago_test"
      | "mercado_pago_orders_test"
      | "mercado_pago_production";
  },
): PlannedEditionCheckout {
  validateEditionCheckoutSnapshot(snapshot);

  const recomputed = allocateByBasisPoints(
    snapshot.distributableAmount,
    snapshot.allocations.map((a, i) => ({
      id: `${a.paymentAccountId}:${a.beneficiaryUserId ?? "x"}:${i}`,
      basisPoints: a.basisPoints,
      sortOrder: i,
    })),
  );
  const byKey = new Map(recomputed.map((r) => [r.id, r]));

  const allocations: PlannedEditionAllocation[] = snapshot.allocations.map((a, i) => {
    const key = `${a.paymentAccountId}:${a.beneficiaryUserId ?? "x"}:${i}`;
    const row = byKey.get(key)!;
    return {
      beneficiaryUserId: a.beneficiaryUserId,
      paymentAccountId: a.paymentAccountId,
      role: a.role,
      basisPoints: a.basisPoints,
      allocationAmountEstimated: row.allocationAmount,
      roundingAdjustment: row.roundingAdjustment,
      beneficiaryDisplayName: a.beneficiaryDisplayName,
      accountEnvironment: a.accountEnvironment,
      paymentProvider: a.paymentProvider,
    };
  });

  const mode = opts?.bridgeMode ?? "manual";
  let modality: PlannedEditionCheckout["modality"] = "MANUAL_SIMULATED";
  if (mode === "mercado_pago_orders_test") {
    modality = "ORDERS_1N_SPLIT";
  } else if (mode === "mercado_pago_test" || mode === "mercado_pago_production") {
    if (allocations.length !== 1 || allocations[0]!.basisPoints !== EDITION_CHECKOUT_BPS_TOTAL) {
      throw new EditionCheckoutAllocationError(
        "CHECKOUT_PRO_N1_ONLY",
        "Checkout Pro OAuth collector solo soporta una allocation al 100% (10000 bps). Para N>1 usar Orders 1:N u otra estrategia documentada.",
      );
    }
    modality = "CHECKOUT_PRO_COLLECTOR_OAUTH";
  } else if (allocations.length === 1) {
    modality = "CHECKOUT_PRO_COLLECTOR_OAUTH";
  }

  return {
    snapshot,
    distributableAmountEstimated: snapshot.distributableAmount,
    providerFeeEstimated: snapshot.providerFeeEstimated,
    platformFee: snapshot.platformFee,
    allocations,
    collectorPaymentAccountId: allocations[0]!.paymentAccountId,
    modality,
  };
}

export function reconcileAllocationsWithConfirmedFee(input: {
  chargedAmount: number;
  platformFee: number;
  providerFeeConfirmed: number;
  planned: PlannedEditionAllocation[];
}): {
  distributableAmountConfirmed: number;
  allocations: Array<PlannedEditionAllocation & { allocationAmountConfirmed: number }>;
} {
  if (!Number.isInteger(input.providerFeeConfirmed) || input.providerFeeConfirmed < 0) {
    throw new EditionCheckoutAllocationError(
      "INVALID_FEE",
      "providerFeeConfirmed must be a non-negative integer",
    );
  }
  const distributable = input.chargedAmount - input.providerFeeConfirmed - input.platformFee;
  if (distributable < 0) {
    throw new EditionCheckoutAllocationError(
      "NEGATIVE_DISTRIBUTABLE",
      "confirmed distributable would be negative",
    );
  }
  const recomputed = allocateByBasisPoints(
    distributable,
    input.planned.map((a, i) => ({
      id: String(i),
      basisPoints: a.basisPoints,
      sortOrder: i,
    })),
  );
  return {
    distributableAmountConfirmed: distributable,
    allocations: input.planned.map((a, i) => ({
      ...a,
      allocationAmountConfirmed: recomputed[i]!.allocationAmount,
      roundingAdjustment: recomputed[i]!.roundingAdjustment,
    })),
  };
}
