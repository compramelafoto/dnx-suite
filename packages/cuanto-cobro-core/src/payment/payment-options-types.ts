import type { EconomicIndexRateMetadata, EconomicIndexRateSource } from "./economic-index-types";

export type CuantoCobroInstallmentInterestMode = "none" | "manual" | "index_suggested";

export type CuantoCobroInstallmentPlanInput = {
  id: string;
  numberOfInstallments: string;
  interestMode: CuantoCobroInstallmentInterestMode;
  interestPercent: string;
  commercialNote: string;
  /** Metadata congelada al aplicar tasa sugerida desde el índice. */
  appliedIndexMetadata?: EconomicIndexRateMetadata | null;
};

export type CuantoCobroPaymentOptionsInput = {
  cashEnabled: boolean;
  cashDiscountPercent: string;
  cashCommercialNote: string;
  installmentPlans: CuantoCobroInstallmentPlanInput[];
};

export type CuantoCobroPaymentOptionsCashSnapshot = {
  enabled: boolean;
  discountPercent: number;
  basePrice: number;
  cashPrice: number;
  commercialNote: string;
};

export type CuantoCobroPaymentOptionsInstallmentSnapshot = {
  id: string;
  numberOfInstallments: number;
  interestMode: CuantoCobroInstallmentInterestMode;
  interestPercent: number;
  financedTotal: number;
  installmentAmount: number;
  commercialNote: string;
  rateSource: EconomicIndexRateSource;
  rateMetadata: EconomicIndexRateMetadata | null;
};

export const CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION = 1;

export type CuantoCobroPaymentOptionsSnapshot = {
  schemaVersion: typeof CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION;
  basePrice: number;
  currency: string;
  countryCode: string;
  calculatedAt: string;
  cash: CuantoCobroPaymentOptionsCashSnapshot | null;
  installmentPlans: CuantoCobroPaymentOptionsInstallmentSnapshot[];
};

export const INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS: CuantoCobroPaymentOptionsInput = {
  cashEnabled: true,
  cashDiscountPercent: "",
  cashCommercialNote: "",
  installmentPlans: [],
};
