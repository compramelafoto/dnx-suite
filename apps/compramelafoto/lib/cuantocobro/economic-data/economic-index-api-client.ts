import type { EconomicIndexRateMetadata } from "../payment/economic-index-types";

export type EconomicIndexApiResponse = {
  available: boolean;
  countryCode: string;
  type: "inflation" | "interest_rate";
  sourceLabel: string;
  queriedAt: string;
  latestPeriod?: string;
  latestMonthlyRate?: number;
  average3m?: number;
  average6m?: number;
  average12m?: number;
  suggestedMonthlyRate?: number;
  suggestedAnnualRate?: number;
  method?: string;
  message?: string;
};

export async function fetchEconomicIndexSuggestion(
  countryCode: string,
  type: "inflation" | "interest_rate",
): Promise<EconomicIndexApiResponse> {
  const params = new URLSearchParams({ country: countryCode, type });
  const response = await fetch(`/api/cuantocobro/economic-indexes?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo consultar el índice económico.");
  }

  return (await response.json()) as EconomicIndexApiResponse;
}

export function economicIndexMetadataFromApiResponse(
  result: EconomicIndexApiResponse,
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
    bcraVariableId: null,
    bcraVariableLabel: null,
  };
}
