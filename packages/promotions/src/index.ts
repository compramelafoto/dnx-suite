export type {
  PromotionDiscountType,
  PromotionPlatform,
  PromotionRedemptionStatus,
  PromotionRecord,
  PromotionUsageCounters,
  PromotionEligibilityKind,
  PromotionEligibilityRule,
  PromotionEligibilityResolution,
  PreviewPromotionInput,
  PromotionQuote,
  PromotionRejectionCode,
  PreviewPromotionResult,
  RedeemPromotionInput,
  RedeemPromotionCommand,
} from "./types";

export {
  PROMOTION_DISCOUNT_TYPES,
  PROMOTION_PLATFORMS,
  PROMOTION_REDEMPTION_STATUSES,
  PROMOTION_ELIGIBILITY_KINDS,
} from "./types";

export { readEligibilityRule } from "./eligibility";
export { normalizePromotionCode, isValidPromotionCodeFormat } from "./normalize";
export { calculateDiscountAmount, buildPromotionQuote } from "./calculate";
export {
  previewPromotion,
  buildRedeemCommand,
  createPromotionEngine,
} from "./engine";
export type { BuildRedeemResult } from "./engine";
