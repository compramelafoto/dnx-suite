import type { PromotionDiscountType, PromotionQuote, PromotionRecord } from "./types";

function assertMinor(amount: number, label: string): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative integer (minor units).`);
  }
}

/**
 * Calcula descuento en minor units. Nunca retorna final negativo.
 * No valida vigencia ni límites — solo aritmética segura.
 */
export function calculateDiscountAmount(input: {
  discountType: PromotionDiscountType;
  discountValue: number;
  originalAmount: number;
  maxDiscountAmount?: number | null;
}): number {
  assertMinor(input.originalAmount, "originalAmount");
  if (input.maxDiscountAmount != null) {
    assertMinor(input.maxDiscountAmount, "maxDiscountAmount");
  }

  let discount = 0;
  if (input.discountType === "PERCENTAGE") {
    if (
      !Number.isInteger(input.discountValue) ||
      input.discountValue < 1 ||
      input.discountValue > 100
    ) {
      throw new Error("PERCENTAGE discountValue must be an integer 1–100.");
    }
    discount = Math.floor((input.originalAmount * input.discountValue) / 100);
  } else {
    assertMinor(input.discountValue, "FIXED_AMOUNT discountValue");
    discount = input.discountValue;
  }

  if (input.maxDiscountAmount != null) {
    discount = Math.min(discount, input.maxDiscountAmount);
  }
  discount = Math.min(discount, input.originalAmount);
  return Math.max(0, discount);
}

export function buildPromotionQuote(input: {
  promotion: Pick<
    PromotionRecord,
    "id" | "code" | "name" | "discountType" | "discountValue" | "maxDiscountAmount"
  >;
  originalAmount: number;
  currency: string;
}): PromotionQuote {
  const discountAmount = calculateDiscountAmount({
    discountType: input.promotion.discountType,
    discountValue: input.promotion.discountValue,
    originalAmount: input.originalAmount,
    maxDiscountAmount: input.promotion.maxDiscountAmount,
  });
  return {
    promotionId: input.promotion.id,
    code: input.promotion.code,
    name: input.promotion.name,
    discountType: input.promotion.discountType,
    discountValue: input.promotion.discountValue,
    originalAmount: input.originalAmount,
    discountAmount,
    finalAmount: input.originalAmount - discountAmount,
    currency: input.currency,
  };
}
