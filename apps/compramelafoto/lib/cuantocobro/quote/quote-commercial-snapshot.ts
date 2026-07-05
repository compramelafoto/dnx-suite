import type { CuantoCobroBusinessProfile } from "../business-profile";
import { parsePaymentOptionsSnapshot } from "../payment/payment-options-calc";
import { normalizeCuantoCobroQuote } from "../normalize-quote";
import type { CuantoCobroQuoteInput } from "../types";
import { businessProfileForCommercialProposal } from "./quote-branding-snapshot";
import { parseFrozenCalculation } from "./quote-frozen";

export type FrozenQuoteCommercialSnapshot = {
  quoteNumber: string;
  versionNumber: number;
  quote: CuantoCobroQuoteInput;
  calculation: NonNullable<ReturnType<typeof parseFrozenCalculation>>;
  paymentOptionsSnapshot: ReturnType<typeof parsePaymentOptionsSnapshot>;
  businessProfile: CuantoCobroBusinessProfile | null;
};

export function parseBusinessProfileSnapshot(value: unknown): CuantoCobroBusinessProfile | null {
  return businessProfileForCommercialProposal(value);
}

export function buildFrozenQuoteCommercialSnapshot(input: {
  quoteNumber: string;
  versionNumber: number;
  quotePayload: unknown;
  calculationSnapshot: unknown;
  paymentOptionsSnapshot: unknown;
  businessProfileSnapshot: unknown;
}): FrozenQuoteCommercialSnapshot | null {
  const calculation = parseFrozenCalculation(input.calculationSnapshot);
  if (!calculation) return null;

  return {
    quoteNumber: input.quoteNumber,
    versionNumber: input.versionNumber,
    quote: normalizeCuantoCobroQuote(
      input.quotePayload && typeof input.quotePayload === "object" && !Array.isArray(input.quotePayload)
        ? (input.quotePayload as Parameters<typeof normalizeCuantoCobroQuote>[0])
        : {},
    ),
    calculation,
    paymentOptionsSnapshot: parsePaymentOptionsSnapshot(input.paymentOptionsSnapshot),
    businessProfile: parseBusinessProfileSnapshot(input.businessProfileSnapshot),
  };
}
