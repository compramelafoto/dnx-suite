import { getEconomicIndexSuggestion } from "../economic-data/economic-data-service";
import type {
  EconomicDataInflationResult,
  EconomicDataInterestRateResult,
} from "../economic-data/economic-data-types";
import { resolveDefaultEconomicIndexType } from "./economic-index-defaults";
import type {
  EconomicIndexLookupResult,
  EconomicIndexProvider,
  EconomicIndexRateMetadata,
  ResolveCountryCodeOptions,
} from "./economic-index-types";

const AR_UNAVAILABLE_MESSAGE =
  "No hay índice automático disponible para tu país todavía.";

function mapIndexResultToLookup(
  result:
    | EconomicDataInflationResult
    | EconomicDataInterestRateResult
    | { available: false; countryCode: string; message?: string },
): EconomicIndexLookupResult {
  if (!result.available) {
    return {
      available: false,
      countryCode: result.countryCode,
      suggestedInterestPercent: null,
      metadata: null,
      unavailableMessage: ("message" in result && result.message) || AR_UNAVAILABLE_MESSAGE,
    };
  }

  const indexResult = result as EconomicDataInflationResult | EconomicDataInterestRateResult;
  const suggestedAnnual = indexResult.suggestedAnnualRate ?? null;

  const metadata: EconomicIndexRateMetadata = {
    indexKind: indexResult.type,
    countryCode: indexResult.countryCode,
    sourceLabel: indexResult.sourceLabel,
    queriedAt: indexResult.queriedAt,
    suggestedPercent: suggestedAnnual,
    method: indexResult.method ?? "unknown",
    latestPeriod: indexResult.latestPeriod ?? null,
    latestMonthlyRate: indexResult.latestMonthlyRate ?? null,
    average3m: indexResult.average3m ?? null,
    average6m: indexResult.average6m ?? null,
    average12m: indexResult.average12m ?? null,
    suggestedMonthlyRate: indexResult.suggestedMonthlyRate ?? null,
    suggestedAnnualRate: suggestedAnnual,
    message: indexResult.message ?? null,
    bcraVariableId: "bcraVariableId" in indexResult ? indexResult.bcraVariableId ?? null : null,
    bcraVariableLabel: "bcraVariableLabel" in indexResult ? indexResult.bcraVariableLabel ?? null : null,
  };

  return {
    available: suggestedAnnual != null,
    countryCode: indexResult.countryCode,
    suggestedInterestPercent: suggestedAnnual,
    metadata,
    unavailableMessage: suggestedAnnual == null ? indexResult.message ?? AR_UNAVAILABLE_MESSAGE : null,
  };
}

function lookupUnavailable(countryCode: string): EconomicIndexLookupResult {
  return {
    available: false,
    countryCode,
    suggestedInterestPercent: null,
    metadata: null,
    unavailableMessage: AR_UNAVAILABLE_MESSAGE,
  };
}

export function normalizeCountryCode(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed) return "";

  if (trimmed === "ar" || trimmed === "argentina" || trimmed.includes("argentin")) return "AR";
  if (trimmed === "uy" || trimmed === "uruguay") return "UY";
  if (trimmed === "cl" || trimmed === "chile") return "CL";
  if (trimmed === "mx" || trimmed === "méxico" || trimmed === "mexico") return "MX";
  if (trimmed === "es" || trimmed === "españa" || trimmed === "espana" || trimmed === "spain") return "ES";
  if (trimmed === "us" || trimmed === "usa" || trimmed === "estados unidos") return "US";

  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();

  return trimmed.slice(0, 2).toUpperCase();
}

export function resolvePhotographerCountryCode(options: ResolveCountryCodeOptions): string {
  const fromBusiness = normalizeCountryCode(options.businessCountry);
  if (fromBusiness) return fromBusiness;

  const currency = (options.profileCurrency ?? "").trim().toUpperCase();
  if (currency === "ARS") return "AR";
  if (currency === "UYU") return "UY";
  if (currency === "CLP") return "CL";
  if (currency === "MXN") return "MX";
  if (currency === "EUR") return "ES";
  if (currency === "USD") return "US";

  return "";
}

export const defaultEconomicIndexProvider: EconomicIndexProvider = {
  async getSuggestedInstallmentInterestRate(countryCode: string): Promise<EconomicIndexLookupResult> {
    const normalized = normalizeCountryCode(countryCode);
    if (normalized !== "AR") return lookupUnavailable(normalized || "XX");

    const indexType = resolveDefaultEconomicIndexType(normalized);
    const result = await getEconomicIndexSuggestion(normalized, indexType);
    if (!result.available || (result.type !== "inflation" && result.type !== "interest_rate")) {
      return mapIndexResultToLookup({
        available: false,
        countryCode: normalized,
        message: "message" in result ? result.message : AR_UNAVAILABLE_MESSAGE,
      });
    }

    return mapIndexResultToLookup(result);
  },
};

export async function getSuggestedInstallmentInterestRate(
  countryCode: string,
  provider: EconomicIndexProvider = defaultEconomicIndexProvider,
): Promise<EconomicIndexLookupResult> {
  return provider.getSuggestedInstallmentInterestRate(countryCode);
}

export { AR_UNAVAILABLE_MESSAGE };

export function economicIndexMetadataFromApiResult(
  result: EconomicDataInflationResult | EconomicDataInterestRateResult,
): EconomicIndexRateMetadata {
  return {
    indexKind: result.type,
    countryCode: result.countryCode,
    sourceLabel: result.sourceLabel,
    queriedAt: result.queriedAt,
    suggestedPercent: result.suggestedAnnualRate ?? null,
    method: result.method ?? "unknown",
    latestPeriod: result.latestPeriod ?? null,
    latestMonthlyRate: result.latestMonthlyRate ?? null,
    average3m: result.average3m ?? null,
    average6m: result.average6m ?? null,
    average12m: result.average12m ?? null,
    suggestedMonthlyRate: result.suggestedMonthlyRate ?? null,
    suggestedAnnualRate: result.suggestedAnnualRate ?? null,
    message: result.message ?? null,
    bcraVariableId: "bcraVariableId" in result ? result.bcraVariableId ?? null : null,
    bcraVariableLabel: "bcraVariableLabel" in result ? result.bcraVariableLabel ?? null : null,
  };
}
