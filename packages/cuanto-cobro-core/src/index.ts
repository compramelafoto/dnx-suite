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
} from "./calculate-cuanto-cobro";

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
  CuantoCobroAssignmentActivity,
  CuantoCobroQuoteAssignment,
} from "./types";
export type { QuoteItemPersonLabor } from "./quote-item-calculations";

export {
  CC_WIZARD_STEPS,
  INITIAL_CUANTO_COBRO_PROFILE,
  INITIAL_CUANTO_COBRO_QUOTE,
  INITIAL_CUANTO_COBRO_CLIENT,
  INITIAL_CUANTO_COBRO_CLIENT_HOURS,
  INITIAL_CUANTO_COBRO_WIZARD_STATE,
} from "./types";

export {
  parseCuantoCobroAmount,
  formatCuantoCobroPriceInput,
  normalizeCuantoCobroPriceInput,
} from "./amount-format";

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
} from "./commercial-positioning";

export {
  getProfileCostHour,
  getProfileMonthlyNeed,
  getQuoteLaborRates,
} from "./hourly-rates";

export { calculateQuoteSummary } from "./quote-item-calculations";
export { calculateClientCosts } from "./client-calculations";
export {
  DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION,
  WEEKS_PER_MONTH,
  computeMonthlyAvailableHours,
  computeMonthlyBillableHours,
  isTimeDistributionComplete,
  isTimeDistributionValid,
} from "./availability";

export type { CuantoCobroEquipmentInventory } from "./equipment/types";
export { INITIAL_EQUIPMENT_INVENTORY } from "./equipment/normalize";
export { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "./payment/payment-options-types";
export type { CuantoCobroPaymentOptionsInput } from "./payment/payment-options-types";
export type { CuantoCobroCommercialDisplayMode } from "./commercial-presentation";

// Precio completo (FOTOFFICE, 15/10/2026): impuestos, comisión, seña, recargos, viáticos, feriados.
export {
  buildPriceBuildUp,
  isPricingExtrasActive,
  monthsBetween,
  normalizePricingExtras,
  parsePercent,
  pricingExtrasFixedMonthly,
  roundUpTo,
  withoutOneTimeAdjustments,
} from "./pricing-extras/price-build-up";
export { summarizeJobPricing, type CuantoCobroJobPricingSummary } from "./pricing-extras/summarize";
export { computeTravel, resolveDistanceKm, straightLineKm } from "./pricing-extras/travel";
export {
  argentinaHolidays,
  easterSunday,
  eventDayType,
  isValidYmd,
  ARGENTINA_HOLIDAY_YEARS_WITH_DECREE,
  type ArgentinaHoliday,
  type EventDayInfo,
  type EventDayType,
} from "./pricing-extras/holidays";
export {
  INITIAL_CUANTO_COBRO_PRICING_EXTRAS,
  CUANTO_COBRO_PRICE_ROUNDING_STEP,
  CUANTO_COBRO_DEFAULT_IVA_PERCENT,
  CUANTO_COBRO_ROUTE_FACTOR,
  type CuantoCobroIvaCondition,
  type CuantoCobroJobAdjustments,
  type CuantoCobroPriceBuildUp,
  type CuantoCobroPricingExtras,
  type CuantoCobroTravelMode,
  type CuantoCobroTravelZone,
} from "./pricing-extras/types";

// Mi estudio (FOTOFFICE, 16/10/2026): estructura de costos de un estudio con equipo.
export {
  getProfileResultSteps,
  type CuantoCobroStudioStepId,
} from "./calculate-cuanto-cobro";
export {
  activeStudioStructure,
  effectiveCoverageSharePercent,
  isSeparateLocalActive,
  isStudioModeActive,
  normalizeStudioStructure,
  parseStudioDecimal,
} from "./studio/normalize";
export {
  computeStudioBreakdown,
  computeStudioBreakdownFor,
  computeStudioPersonHours,
  computeStudioPersonMonthlyCost,
  getStudioMissingFields,
  isInStudioStructure,
  sumStudioFixedCosts,
} from "./studio/capacity";
export {
  createDefaultStudioBusinessLines,
  createDefaultStudioFixedCostGroups,
  createStudioOwner,
  createStudioPerson,
  defaultFixedCostScope,
  fixedCostScope,
  INITIAL_STUDIO_STRUCTURE,
  STUDIO_DEFAULT_BILLABLE_PERCENT,
  STUDIO_EMPLOYMENT_TYPES,
  STUDIO_MAX_PEOPLE,
  STUDIO_OWNER_ID,
  STUDIO_SKILLS,
  personScope,
  type CuantoCobroStudioBreakdown,
  type CuantoCobroStudioStructure,
  type StudioBusinessLine,
  type StudioEmploymentType,
  type StudioFixedCostGroup,
  type StudioFixedCostItem,
  type StudioPerson,
  type StudioPersonBreakdown,
  type StudioProfitMode,
  type StudioScope,
  type StudioSkill,
} from "./studio/types";

// Varias cámaras: la principal es la #1 ("primary"); las demás en `profile.cameras`.
export {
  createCamera,
  MAX_EXTRA_CAMERAS,
  normalizeCameras,
  PRIMARY_CAMERA_ID,
  resolveProfileCameras,
  type CuantoCobroCamera,
  type ResolvedCamera,
} from "./cameras";
export { CAMERA_BODY_PRESETS } from "./camera-equipment";
