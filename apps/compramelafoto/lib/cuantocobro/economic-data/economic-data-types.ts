export type EconomicDataIndexType = "inflation" | "interest_rate" | "currency";

export type EconomicDataMonthlyPoint = {
  period: string;
  monthlyRatePercent: number;
};

export type EconomicDataInflationResult = {
  available: boolean;
  countryCode: "AR";
  type: "inflation";
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
  seriesId?: string;
};

export type EconomicDataInterestRateResult = {
  available: boolean;
  countryCode: "AR";
  type: "interest_rate";
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
  bcraVariableId?: number;
  bcraVariableLabel?: string;
};

export type EconomicDataUnavailableResult = {
  available: false;
  countryCode: string;
  type: EconomicDataIndexType;
  sourceLabel: string;
  queriedAt: string;
  message: string;
};

export type EconomicDataIndexResult =
  | EconomicDataInflationResult
  | EconomicDataInterestRateResult
  | EconomicDataUnavailableResult;

export type EconomicDataProvider = {
  countryCode: string;
  getInflationSuggestion(): Promise<EconomicDataInflationResult | EconomicDataUnavailableResult>;
  getInterestRateSuggestion(): Promise<EconomicDataInterestRateResult | EconomicDataUnavailableResult>;
};

export type FetchJsonFn = (url: string, init?: RequestInit) => Promise<unknown>;
