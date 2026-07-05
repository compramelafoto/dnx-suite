import { normalizeCuantoCobroQuote } from "../normalize-quote";
import type {
  CuantoCobroCalculationResult,
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
} from "../types";
import type { CuantoCobroPaymentOptionsSnapshot } from "../payment/payment-options-types";

export { formatQuoteVersionLabel } from "./quote-format";
export { parseFrozenCalculation } from "./quote-frozen";

export function buildQuoteVersionSnapshots(input: {
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
  calculation: CuantoCobroCalculationResult;
  paymentOptionsSnapshot?: CuantoCobroPaymentOptionsSnapshot | Record<string, unknown>;
}) {
  const frozenAt = new Date().toISOString();

  return {
    quotePayload: normalizeCuantoCobroQuote(input.quote),
    profileSnapshot: input.profile,
    calculationSnapshot: {
      ...input.calculation,
      frozenAt,
    },
    paymentOptionsSnapshot: input.paymentOptionsSnapshot ?? {},
  };
}

export function buildMigratedCalculationSnapshot(row: {
  currency: string;
  chosenPriceCents: number | null;
  recommendedPriceCents: number | null;
  minimumPriceCents: number | null;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    status: "complete",
    currency: row.currency,
    chosenPriceCents: row.chosenPriceCents,
    recommendedPriceCents: row.recommendedPriceCents,
    minimumPriceCents: row.minimumPriceCents,
    recommendedBusinessPrice: row.recommendedPriceCents ?? 0,
    minimumSustainablePrice: row.minimumPriceCents ?? 0,
    chosenManualPrice: row.chosenPriceCents,
    chosenPriceEffective: row.chosenPriceCents ?? row.recommendedPriceCents ?? 0,
    frozenAt: row.updatedAt.toISOString(),
    migrated: true,
  };
}
