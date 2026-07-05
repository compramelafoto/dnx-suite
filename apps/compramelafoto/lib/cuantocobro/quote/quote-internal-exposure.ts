/** Campos que nunca deben exponerse en vista pública o PDF comercial. */
export const QUOTE_INTERNAL_CALCULATION_KEYS = [
  "minimumSustainablePrice",
  "minimumPrice",
  "hourlyRate",
  "monthlyNeed",
  "estimatedMargin",
  "marginRatio",
  "profitabilityStatus",
  "equipmentSavings",
  "cameraWear",
  "cameraWearSummary",
  "variableCosts",
  "clientSummary",
] as const;

export function stripInternalCalculationForPublic<T extends Record<string, unknown>>(calculation: T): T {
  const clone = { ...calculation };
  for (const key of QUOTE_INTERNAL_CALCULATION_KEYS) {
    delete clone[key];
  }
  return clone;
}
