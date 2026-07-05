import type { EconomicDataUnavailableResult } from "../economic-data-types";

export const MANUAL_ECONOMIC_DATA_MESSAGE =
  "No hay índice automático disponible para tu país todavía. Podés cargar la tasa manualmente.";

export function buildManualUnavailableResult(
  countryCode: string,
  type: "inflation" | "interest_rate" | "currency",
): EconomicDataUnavailableResult {
  return {
    available: false,
    countryCode,
    type,
    sourceLabel: "Manual",
    queriedAt: new Date().toISOString(),
    message: MANUAL_ECONOMIC_DATA_MESSAGE,
  };
}
