import { PERCENTAGE_BPS_TOTAL } from "../constants";

export type PercentageAllocationInput = {
  id: string;
  /** Basis points (10000 = 100%). */
  shareBps: number;
  sortOrder: number;
};

export type PercentageAllocationResult = {
  id: string;
  shareBps: number;
  allocationAmount: number;
  /** Ajuste de redondeo aplicado (puede ser 0, +1, -1, …). */
  roundingAdjustment: number;
};

/**
 * LARGEST_REMAINDER determinístico:
 * 1) floor(distributable * bps / 10000)
 * 2) repartir remanente a quienes tienen mayor fracción residual
 * 3) desempate por sortOrder asc, luego id asc
 * Garantiza suma exacta = distributableAmount.
 */
export function allocateByLargestRemainder(
  distributableAmount: number,
  allocations: PercentageAllocationInput[],
): PercentageAllocationResult[] {
  if (!Number.isInteger(distributableAmount) || distributableAmount < 0) {
    throw new Error("distributableAmount must be a non-negative integer");
  }
  const totalBps = allocations.reduce((s, a) => s + a.shareBps, 0);
  if (totalBps !== PERCENTAGE_BPS_TOTAL) {
    throw new Error(`shareBps must sum to ${PERCENTAGE_BPS_TOTAL}, got ${totalBps}`);
  }
  if (allocations.length === 0) return [];

  const base = allocations.map((a) => {
    const exact = (distributableAmount * a.shareBps) / PERCENTAGE_BPS_TOTAL;
    const floor = Math.floor(exact);
    return {
      id: a.id,
      shareBps: a.shareBps,
      sortOrder: a.sortOrder,
      floor,
      remainder: exact - floor,
    };
  });

  const assigned = base.reduce((s, b) => s + b.floor, 0);
  let leftover = distributableAmount - assigned;

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
      shareBps: b.shareBps,
      allocationAmount: b.floor + adj,
      roundingAdjustment: adj,
    };
  });
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}
