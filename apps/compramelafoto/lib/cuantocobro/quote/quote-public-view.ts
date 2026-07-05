import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import type { CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import type { QuotePublicViewDto } from "./quote-delivery-db";
import { QUOTE_INTERNAL_CALCULATION_KEYS } from "./quote-internal-exposure";

export type QuotePublicViewPayload = {
  quoteNumber: string;
  versionNumber: number;
  businessProfile: CuantoCobroBusinessProfile | null;
  quote: CuantoCobroQuoteInput;
  calculation: Record<string, unknown>;
  paymentOptionsSnapshot: unknown;
};

export function buildQuotePublicViewPayload(view: QuotePublicViewDto): QuotePublicViewPayload {
  const calculation =
    view.snapshot.calculation && typeof view.snapshot.calculation === "object"
      ? { ...(view.snapshot.calculation as Record<string, unknown>) }
      : {};

  for (const key of QUOTE_INTERNAL_CALCULATION_KEYS) {
    delete calculation[key];
  }

  delete calculation.minimumSustainablePrice;
  delete calculation.minimumPrice;
  delete calculation.recommendedBusinessPrice;
  delete calculation.chosenManualPrice;
  delete calculation.chosenMargin;
  delete calculation.chosenMarginRatio;
  delete calculation.chosenMarginStatus;
  delete calculation.chosenPriceCommercialStatus;
  delete calculation.chosenPriceDeltaFromRecommended;
  delete calculation.profitabilityStatus;
  delete calculation.quoteSummary;
  delete calculation.warnings;

  return {
    quoteNumber: view.quoteNumber,
    versionNumber: view.versionNumber,
    businessProfile: view.businessProfile,
    quote: view.snapshot.quote,
    calculation,
    paymentOptionsSnapshot: view.snapshot.paymentOptionsSnapshot,
  };
}

export function quotePublicPayloadExposesInternalData(payload: QuotePublicViewPayload): boolean {
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbidden = [
    "minimumsustainableprice",
    "hourlyrate",
    "monthlyneed",
    "estimatedmargin",
    "camerawear",
    "variablecosts",
    "profitabilitystatus",
    "laborcost",
    "minimumprice",
  ];
  return forbidden.some((needle) => serialized.includes(needle));
}
