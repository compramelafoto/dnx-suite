export type {
  EconomicDataIndexResult,
  EconomicDataIndexType,
  EconomicDataInflationResult,
  EconomicDataInterestRateResult,
  EconomicDataUnavailableResult,
} from "./economic-data-types";

export {
  averageLastMonths,
  buildInflationSuggestionFromPoints,
  compoundAnnualRateFromMonthly,
  decimalToMonthlyPercent,
  parseDatosGobArPercentChangeSeries,
} from "./inflation-math";

export {
  ECONOMIC_DATA_CACHE_TTL_MS,
  clearEconomicDataCache,
  getEconomicDataCacheKey,
  readEconomicDataCache,
  writeEconomicDataCache,
} from "./economic-data-cache";

export {
  AR_BCRA_BADLAR_VARIABLE_ID,
  AR_BCRA_POLICY_RATE_VARIABLE_ID,
  AR_IPC_SERIES_ID,
  fetchArgentinaInflationSuggestion,
  fetchArgentinaInterestRateSuggestion,
} from "./providers/argentina-provider";

export { MANUAL_ECONOMIC_DATA_MESSAGE, buildManualUnavailableResult } from "./providers/manual-provider";
export { getWorldBankIndexSuggestion } from "./providers/worldbank-provider";

export {
  EconomicDataService,
  defaultEconomicDataService,
  getEconomicIndexSuggestion,
} from "./economic-data-service";
