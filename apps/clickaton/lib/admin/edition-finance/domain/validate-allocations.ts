import { PERCENTAGE_BPS_TOTAL } from "../constants";
import { percentToBps } from "./rounding";
import { EditionFinanceError } from "./errors";

export type AllocationDraftInput = {
  financialIdentityId: string;
  paymentConnectionId?: string | null;
  role?: string;
  /** Porcentaje 0–100. */
  sharePercent: number;
  sortOrder?: number;
};

export function validateAllocationDrafts(allocations: AllocationDraftInput[]): {
  totalBps: number;
  rows: Array<AllocationDraftInput & { shareBps: number }>;
} {
  if (allocations.length === 0) {
    throw new EditionFinanceError(
      "VALIDATION",
      "La distribución necesita al menos un beneficiario.",
    );
  }
  const ids = new Set<string>();
  const rows = allocations.map((a, index) => {
    if (!a.financialIdentityId) {
      throw new EditionFinanceError("VALIDATION", "Falta identidad financiera del beneficiario.");
    }
    if (ids.has(a.financialIdentityId)) {
      throw new EditionFinanceError(
        "VALIDATION",
        "No se puede duplicar el mismo beneficiario en una versión.",
      );
    }
    ids.add(a.financialIdentityId);
    if (!Number.isFinite(a.sharePercent) || a.sharePercent <= 0 || a.sharePercent > 100) {
      throw new EditionFinanceError(
        "VALIDATION",
        "Cada porcentaje debe estar entre 0 exclusivo y 100 inclusive.",
      );
    }
    const shareBps = percentToBps(a.sharePercent);
    return {
      ...a,
      shareBps,
      sortOrder: a.sortOrder ?? (index + 1) * 10,
    };
  });

  const totalBps = rows.reduce((s, r) => s + r.shareBps, 0);
  if (totalBps < PERCENTAGE_BPS_TOTAL) {
    throw new EditionFinanceError(
      "INVALID_SHARE_SUM",
      `La suma de porcentajes es menor a 100% (${totalBps / 100}%).`,
      { totalBps },
    );
  }
  if (totalBps > PERCENTAGE_BPS_TOTAL) {
    throw new EditionFinanceError(
      "INVALID_SHARE_SUM",
      `La suma de porcentajes es mayor a 100% (${totalBps / 100}%).`,
      { totalBps },
    );
  }
  return { totalBps, rows };
}
