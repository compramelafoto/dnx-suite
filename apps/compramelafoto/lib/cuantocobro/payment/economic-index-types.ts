/** Tipos de índice económico soportados (futuro: proveedores por país). */
export type EconomicIndexKind = "inflation" | "interest_rate" | "currency" | "manual";

export type EconomicIndexRateSource = "manual" | "index" | "none";

export type EconomicIndexRateMetadata = {
  indexKind: EconomicIndexKind;
  countryCode: string;
  sourceLabel: string;
  queriedAt: string | null;
  suggestedPercent: number | null;
  method: string;
  latestPeriod?: string | null;
  latestMonthlyRate?: number | null;
  average3m?: number | null;
  average6m?: number | null;
  average12m?: number | null;
  suggestedMonthlyRate?: number | null;
  suggestedAnnualRate?: number | null;
  message?: string | null;
  bcraVariableId?: number | null;
  bcraVariableLabel?: string | null;
};

export type EconomicIndexLookupResult = {
  available: boolean;
  countryCode: string;
  suggestedInterestPercent: number | null;
  metadata: EconomicIndexRateMetadata | null;
  unavailableMessage: string | null;
};

/** Contrato para proveedores centralizados de índices por país. */
export type EconomicIndexProvider = {
  getSuggestedInstallmentInterestRate(countryCode: string): Promise<EconomicIndexLookupResult>;
};

export type ResolveCountryCodeOptions = {
  businessCountry?: string | null;
  profileCurrency?: string | null;
};
