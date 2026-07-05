import type { EconomicIndexRateMetadata, EconomicIndexRateSource } from "./economic-index-types";
import type {
  CuantoCobroInstallmentPlanInput,
  CuantoCobroPaymentOptionsCashSnapshot,
  CuantoCobroPaymentOptionsInput,
  CuantoCobroPaymentOptionsInstallmentSnapshot,
  CuantoCobroPaymentOptionsSnapshot,
} from "./payment-options-types";
import { CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION } from "./payment-options-types";

function parseNonNegativeNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function parsePositiveInt(value: string): number {
  const num = Math.round(parseNonNegativeNumber(value));
  return num > 0 ? num : 0;
}

export function resolvePaymentBasePrice(input: {
  chosenPriceEffective?: number | null;
  recommendedBusinessPrice?: number | null;
}): number {
  if (typeof input.chosenPriceEffective === "number" && input.chosenPriceEffective > 0) {
    return Math.round(input.chosenPriceEffective);
  }
  if (typeof input.recommendedBusinessPrice === "number" && input.recommendedBusinessPrice > 0) {
    return Math.round(input.recommendedBusinessPrice);
  }
  return 0;
}

export function calculateCashPrice(basePrice: number, discountPercent: number): number {
  if (basePrice <= 0) return 0;
  const clampedDiscount = Math.min(Math.max(discountPercent, 0), 100);
  return Math.round(basePrice * (1 - clampedDiscount / 100));
}

export function calculateFinancedTotal(basePrice: number, interestPercent: number): number {
  if (basePrice <= 0) return 0;
  const clampedInterest = Math.max(interestPercent, 0);
  return Math.round(basePrice * (1 + clampedInterest / 100));
}

export function calculateInstallmentAmount(financedTotal: number, numberOfInstallments: number): number {
  if (financedTotal <= 0 || numberOfInstallments <= 0) return 0;
  return Math.round(financedTotal / numberOfInstallments);
}

export function resolveInstallmentInterestPercent(
  plan: CuantoCobroInstallmentPlanInput,
  countryCode: string,
  fetchedIndex?: {
    interestPercent: number;
    rateMetadata: CuantoCobroPaymentOptionsInstallmentSnapshot["rateMetadata"];
  } | null,
): {
  interestPercent: number;
  rateSource: EconomicIndexRateSource;
  rateMetadata: CuantoCobroPaymentOptionsInstallmentSnapshot["rateMetadata"];
} {
  if (plan.interestMode === "none") {
    return { interestPercent: 0, rateSource: "none", rateMetadata: null };
  }

  if (plan.interestMode === "manual") {
    return {
      interestPercent: parseNonNegativeNumber(plan.interestPercent),
      rateSource: "manual",
      rateMetadata: null,
    };
  }

  if (plan.appliedIndexMetadata) {
    const fromMetadata = plan.appliedIndexMetadata.suggestedAnnualRate ?? plan.appliedIndexMetadata.suggestedPercent;
    const interestPercent =
      parseNonNegativeNumber(plan.interestPercent) || (fromMetadata ?? 0);
    return {
      interestPercent,
      rateSource: "index",
      rateMetadata: plan.appliedIndexMetadata,
    };
  }

  if (fetchedIndex) {
    return {
      interestPercent: fetchedIndex.interestPercent,
      rateSource: "index",
      rateMetadata: fetchedIndex.rateMetadata,
    };
  }

  const manualFallback = parseNonNegativeNumber(plan.interestPercent);
  return {
    interestPercent: manualFallback,
    rateSource: manualFallback > 0 ? "manual" : "manual",
    rateMetadata: null,
  };
}

export async function resolveInstallmentInterestPercentAsync(
  plan: CuantoCobroInstallmentPlanInput,
  countryCode: string,
): Promise<{
  interestPercent: number;
  rateSource: EconomicIndexRateSource;
  rateMetadata: CuantoCobroPaymentOptionsInstallmentSnapshot["rateMetadata"];
}> {
  if (plan.interestMode !== "index_suggested" || plan.appliedIndexMetadata) {
    return resolveInstallmentInterestPercent(plan, countryCode);
  }

  const { getSuggestedInstallmentInterestRate } = await import("./economic-index-provider");
  const lookup = await getSuggestedInstallmentInterestRate(countryCode);
  if (lookup.available && lookup.suggestedInterestPercent != null) {
    return resolveInstallmentInterestPercent(plan, countryCode, {
      interestPercent: lookup.suggestedInterestPercent,
      rateMetadata: lookup.metadata,
    });
  }

  return resolveInstallmentInterestPercent(plan, countryCode);
}

export function buildInstallmentPlanSnapshot(
  plan: CuantoCobroInstallmentPlanInput,
  basePrice: number,
  countryCode: string,
): CuantoCobroPaymentOptionsInstallmentSnapshot | null {
  const numberOfInstallments = parsePositiveInt(plan.numberOfInstallments);
  if (numberOfInstallments <= 0) return null;

  const { interestPercent, rateSource, rateMetadata } = resolveInstallmentInterestPercent(plan, countryCode);
  const financedTotal = calculateFinancedTotal(basePrice, interestPercent);
  const installmentAmount = calculateInstallmentAmount(financedTotal, numberOfInstallments);

  return {
    id: plan.id,
    numberOfInstallments,
    interestMode: plan.interestMode,
    interestPercent,
    financedTotal,
    installmentAmount,
    commercialNote: plan.commercialNote.trim(),
    rateSource,
    rateMetadata,
  };
}

export function buildCashOptionSnapshot(
  options: CuantoCobroPaymentOptionsInput,
  basePrice: number,
): CuantoCobroPaymentOptionsCashSnapshot | null {
  if (!options.cashEnabled || basePrice <= 0) return null;

  const discountPercent = parseNonNegativeNumber(options.cashDiscountPercent);

  return {
    enabled: true,
    discountPercent,
    basePrice,
    cashPrice: calculateCashPrice(basePrice, discountPercent),
    commercialNote: options.cashCommercialNote.trim(),
  };
}

export function buildPaymentOptionsSnapshot(input: {
  basePrice: number;
  currency: string;
  countryCode: string;
  paymentOptions: CuantoCobroPaymentOptionsInput;
  calculatedAt?: string;
}): CuantoCobroPaymentOptionsSnapshot {
  const basePrice = Math.max(0, Math.round(input.basePrice));
  const installmentPlans = input.paymentOptions.installmentPlans
    .map((plan) => buildInstallmentPlanSnapshot(plan, basePrice, input.countryCode))
    .filter((plan): plan is CuantoCobroPaymentOptionsInstallmentSnapshot => plan != null);

  return {
    schemaVersion: CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
    basePrice,
    currency: input.currency,
    countryCode: input.countryCode,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
    cash: buildCashOptionSnapshot(input.paymentOptions, basePrice),
    installmentPlans,
  };
}

export function hasPaymentOptionsPresentation(snapshot: CuantoCobroPaymentOptionsSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return Boolean(snapshot.cash?.enabled) || snapshot.installmentPlans.length > 0;
}

export function parsePaymentOptionsSnapshot(value: unknown): CuantoCobroPaymentOptionsSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION) return null;
  if (typeof record.basePrice !== "number") return null;
  return value as CuantoCobroPaymentOptionsSnapshot;
}
