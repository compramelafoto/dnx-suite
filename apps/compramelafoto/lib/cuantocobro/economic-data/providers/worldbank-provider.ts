import type { EconomicDataIndexResult } from "../economic-data-types";

/**
 * Placeholder para índices internacionales vía World Bank.
 * TODO: conectar API World Bank (indicadores inflación / tasas por país).
 */
export async function getWorldBankIndexSuggestion(_countryCode: string): Promise<EconomicDataIndexResult | null> {
  return null;
}
