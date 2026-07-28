export const PROMOTION_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];

export const PROMOTION_PLATFORMS = [
  "CLICKATON",
  "FOTORANK",
  "COMPRAMELAFOTO",
  "FOTOFFICE",
  "INFOSPOT",
  "OTHER",
] as const;
export type PromotionPlatform = (typeof PROMOTION_PLATFORMS)[number];

export const PROMOTION_REDEMPTION_STATUSES = [
  "RESERVED",
  "CONFIRMED",
  "RELEASED",
] as const;
export type PromotionRedemptionStatus = (typeof PROMOTION_REDEMPTION_STATUSES)[number];

/** Promoción persistida (vista de dominio; sin secretos). */
export type PromotionRecord = {
  id: string;
  /** Código normalizado (uppercase, sin espacios). */
  code: string;
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  /**
   * PERCENTAGE: 1–100 (porcentaje entero).
   * FIXED_AMOUNT: minor units (centavos).
   */
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumPurchaseAmount: number | null;
  startsAt: Date;
  endsAt: Date;
  totalUsageLimit: number | null;
  perUserUsageLimit: number | null;
  isActive: boolean;
  platform: string;
  editionId: string | null;
  metadata: Record<string, unknown> | null;
};

export type PromotionUsageCounters = {
  /** Redenciones que cuentan (RESERVED + CONFIRMED). */
  totalActiveRedemptions: number;
  /** Por usuario (si userId presente). */
  userActiveRedemptions: number;
};

export type PreviewPromotionInput = {
  promotion: PromotionRecord;
  usage: PromotionUsageCounters;
  /** Monto original en minor units (precio de fase / ticket). */
  originalAmount: number;
  currency: string;
  platform: string;
  editionId?: string | null;
  userId?: number | null;
  now?: Date;
};

export type PromotionQuote = {
  promotionId: string;
  code: string;
  name: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
};

export type PromotionRejectionCode =
  | "CODE_NOT_FOUND"
  | "CODE_INACTIVE"
  | "CODE_NOT_STARTED"
  | "CODE_EXPIRED"
  | "PLATFORM_MISMATCH"
  | "EDITION_MISMATCH"
  | "MINIMUM_NOT_MET"
  | "TOTAL_LIMIT_REACHED"
  | "USER_LIMIT_REACHED"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_PROMOTION";

export type PreviewPromotionResult =
  | { ok: true; quote: PromotionQuote }
  | { ok: false; code: PromotionRejectionCode; message: string };

export type RedeemPromotionInput = PreviewPromotionInput & {
  orderId: string;
  registrationId?: string | null;
  idempotencyKey: string;
};

export type RedeemPromotionCommand = {
  promotionId: string;
  userId: number | null;
  registrationId: string | null;
  orderId: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  platform: string;
  editionId: string | null;
  idempotencyKey: string;
  status: PromotionRedemptionStatus;
};
