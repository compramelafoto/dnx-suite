export type {
  PromotionDiscountType,
  PromotionPlatform,
  PromotionRedemptionStatus,
  PromotionRecord,
  PromotionUsageCounters,
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
} from "./types";

export { normalizePromotionCode, isValidPromotionCodeFormat } from "./normalize";
export { calculateDiscountAmount, buildPromotionQuote } from "./calculate";
export {
  previewPromotion,
  buildRedeemCommand,
  createPromotionEngine,
} from "./engine";
export type { BuildRedeemResult } from "./engine";
