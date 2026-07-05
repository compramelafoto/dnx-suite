import {
  getEconomicDataCacheKey,
  readEconomicDataCache,
  writeEconomicDataCache,
} from "./economic-data-cache";
import type { EconomicDataIndexResult, EconomicDataIndexType } from "./economic-data-types";
import {
  fetchArgentinaInflationSuggestion,
  fetchArgentinaInterestRateSuggestion,
  type ArgentinaProviderOptions,
} from "./providers/argentina-provider";
import { buildManualUnavailableResult } from "./providers/manual-provider";

export type EconomicDataServiceOptions = ArgentinaProviderOptions & {
  useCache?: boolean;
};

export class EconomicDataService {
  constructor(private readonly options: EconomicDataServiceOptions = {}) {}

  async getIndexSuggestion(countryCode: string, type: EconomicDataIndexType): Promise<EconomicDataIndexResult> {
    const normalized = countryCode.trim().toUpperCase();
    const cacheKey = getEconomicDataCacheKey(normalized, type);

    if (this.options.useCache !== false) {
      const cached = readEconomicDataCache<EconomicDataIndexResult>(cacheKey);
      if (cached) return cached;
    }

    let result: EconomicDataIndexResult;

    if (normalized === "AR") {
      if (type === "inflation") {
        result = await fetchArgentinaInflationSuggestion(this.options);
      } else if (type === "interest_rate") {
        result = await fetchArgentinaInterestRateSuggestion(this.options);
      } else {
        result = buildManualUnavailableResult(normalized, type);
      }
    } else {
      result = buildManualUnavailableResult(normalized || "XX", type);
    }

    if (this.options.useCache !== false) {
      writeEconomicDataCache(cacheKey, result);
    }

    return result;
  }
}

export const defaultEconomicDataService = new EconomicDataService();

export async function getEconomicIndexSuggestion(
  countryCode: string,
  type: EconomicDataIndexType,
  service: EconomicDataService = defaultEconomicDataService,
): Promise<EconomicDataIndexResult> {
  return service.getIndexSuggestion(countryCode, type);
}
