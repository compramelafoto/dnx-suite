import type { CuantoCobroCalculationComplete } from "../types";

export function parseFrozenCalculation(snapshot: unknown): CuantoCobroCalculationComplete | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;

  const record = snapshot as Record<string, unknown>;
  if (record.status !== "complete") return null;
  if (typeof record.recommendedBusinessPrice !== "number") return null;
  if (typeof record.minimumSustainablePrice !== "number") return null;
  if (typeof record.currency !== "string") return null;

  return snapshot as CuantoCobroCalculationComplete;
}
