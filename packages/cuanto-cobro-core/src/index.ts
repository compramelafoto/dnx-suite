/**
 * @repo/cuanto-cobro-core — public API
 * Pure calculation domain for ¿Cuánto Cobro?
 */

export {
  calculateCuantoCobro,
  getCuantoCobroMissingFields,
  isCuantoCobroProfileComplete,
  getFirstIncompleteProfileStepIndex,
  getFirstQuoteStepIndex,
  formatCuantoCobroCurrency,
  formatCuantoCobroHours,
  getProfileHourlyRate,
  CUANTO_COBRO_WEEKS_PER_MONTH,
  CUANTO_COBRO_RECOMMENDED_MULTIPLIER,
  CUANTO_COBRO_LOW_BILLABLE_MONTHLY_HOURS,
  type CuantoCobroCalculationComplete,
  type CuantoCobroCalculationIncomplete,
} from "./calculate-cuanto-cobro.js";

export type {
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
  CuantoCobroCalculationResult,
  CuantoCobroQuoteItem,
  CuantoCobroQuoteItemType,
  CuantoCobroClientInput,
  CuantoCobroClientHoursInput,
  CuantoCobroWizardState,
  MonthlyExpenseGroup,
  MonthlyExpenseItem,
  PhotographyTimeDistribution,
} from "./types.js";

export {
  CC_WIZARD_STEPS,
  INITIAL_CUANTO_COBRO_PROFILE,
  INITIAL_CUANTO_COBRO_QUOTE,
  INITIAL_CUANTO_COBRO_CLIENT,
  INITIAL_CUANTO_COBRO_CLIENT_HOURS,
  INITIAL_CUANTO_COBRO_WIZARD_STATE,
} from "./types.js";

export {
  parseCuantoCobroAmount,
  formatCuantoCobroPriceInput,
  normalizeCuantoCobroPriceInput,
} from "./amount-format.js";

export {
  computeMinimumSustainablePrice,
  computeRecommendedBusinessPrice,
  getCommercialPositioningFactor,
  getCommercialPositioningOption,
  getEffectiveCommercialPositioningId,
  COMMERCIAL_POSITIONING_OPTIONS,
  DEFAULT_COMMERCIAL_POSITIONING_ID,
  roundCuantoCobroPrice,
  type CommercialPositioningId,
} from "./commercial-positioning.js";

export {
  getProfileCostHour,
  getProfileMonthlyNeed,
  getQuoteLaborRates,
} from "./hourly-rates.js";

export { calculateQuoteSummary } from "./quote-item-calculations.js";
export { calculateClientCosts } from "./client-calculations.js";
export {
  DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION,
  WEEKS_PER_MONTH,
  computeMonthlyAvailableHours,
  computeMonthlyBillableHours,
  isTimeDistributionComplete,
  isTimeDistributionValid,
} from "./availability.js";

export type { CuantoCobroEquipmentInventory } from "./equipment/types.js";
export { INITIAL_EQUIPMENT_INVENTORY } from "./equipment/normalize.js";
export { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "./payment/payment-options-types.js";
export type { CuantoCobroPaymentOptionsInput } from "./payment/payment-options-types.js";
export type { CuantoCobroCommercialDisplayMode } from "./commercial-presentation.js";
