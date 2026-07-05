export type {
  EconomicIndexKind,
  EconomicIndexLookupResult,
  EconomicIndexProvider,
  EconomicIndexRateMetadata,
  EconomicIndexRateSource,
  ResolveCountryCodeOptions,
} from "./economic-index-types";

export {
  AR_UNAVAILABLE_MESSAGE,
  defaultEconomicIndexProvider,
  getSuggestedInstallmentInterestRate,
  normalizeCountryCode,
  resolvePhotographerCountryCode,
} from "./economic-index-provider";

export { resolveDefaultEconomicIndexType } from "./economic-index-defaults";
export type { DefaultEconomicIndexType } from "./economic-index-defaults";

export type {
  CuantoCobroInstallmentInterestMode,
  CuantoCobroInstallmentPlanInput,
  CuantoCobroPaymentOptionsCashSnapshot,
  CuantoCobroPaymentOptionsInput,
  CuantoCobroPaymentOptionsInstallmentSnapshot,
  CuantoCobroPaymentOptionsSnapshot,
} from "./payment-options-types";

export {
  CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
  INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
} from "./payment-options-types";

export {
  buildCashOptionSnapshot,
  buildInstallmentPlanSnapshot,
  buildPaymentOptionsSnapshot,
  calculateCashPrice,
  calculateFinancedTotal,
  calculateInstallmentAmount,
  hasPaymentOptionsPresentation,
  parsePaymentOptionsSnapshot,
  resolveInstallmentInterestPercent,
  resolvePaymentBasePrice,
} from "./payment-options-calc";

export { createEmptyInstallmentPlan, normalizePaymentOptions } from "./normalize-payment-options";

export {
  buildPaymentOptionsPreviewLines,
  formatPaymentOptionCashLine,
  formatPaymentOptionInstallmentLine,
} from "./payment-options-preview";
