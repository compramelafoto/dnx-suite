import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPromotionQuote, calculateDiscountAmount } from "./calculate";
import { buildRedeemCommand, previewPromotion } from "./engine";
import { isValidPromotionCodeFormat, normalizePromotionCode } from "./normalize";
import type { PromotionRecord, PromotionUsageCounters } from "./types";

function promo(partial: Partial<PromotionRecord> & Pick<PromotionRecord, "id" | "code" | "discountType" | "discountValue">): PromotionRecord {
  const now = Date.now();
  return {
    name: partial.name ?? partial.code,
    description: null,
    maxDiscountAmount: null,
    minimumPurchaseAmount: null,
    startsAt: new Date(now - 86_400_000),
    endsAt: new Date(now + 86_400_000),
    totalUsageLimit: null,
    perUserUsageLimit: 1,
    isActive: true,
    platform: "CLICKATON",
    editionId: "ed1",
    metadata: null,
    ...partial,
  };
}

const usageZero: PromotionUsageCounters = {
  totalActiveRedemptions: 0,
  userActiveRedemptions: 0,
};

describe("normalizePromotionCode", () => {
  it("normalizes case and spaces", () => {
    assert.equal(normalizePromotionCode("  clickaton50 "), "CLICKATON50");
    assert.equal(normalizePromotionCode("bienvenida-5000"), "BIENVENIDA-5000");
  });
  it("strips unsafe chars", () => {
    assert.equal(normalizePromotionCode("AB@#12"), "AB12");
  });
  it("validates format", () => {
    assert.equal(isValidPromotionCodeFormat("CLICKATON50"), true);
    assert.equal(isValidPromotionCodeFormat("AB"), false);
  });
});

describe("calculateDiscountAmount", () => {
  it("applies percentage", () => {
    assert.equal(
      calculateDiscountAmount({
        discountType: "PERCENTAGE",
        discountValue: 50,
        originalAmount: 2_500_000,
      }),
      1_250_000,
    );
  });
  it("applies fixed amount", () => {
    assert.equal(
      calculateDiscountAmount({
        discountType: "FIXED_AMOUNT",
        discountValue: 500_000,
        originalAmount: 2_500_000,
      }),
      500_000,
    );
  });
  it("caps with maxDiscountAmount", () => {
    assert.equal(
      calculateDiscountAmount({
        discountType: "PERCENTAGE",
        discountValue: 80,
        originalAmount: 2_500_000,
        maxDiscountAmount: 500_000,
      }),
      500_000,
    );
  });
  it("never goes negative / never exceeds original", () => {
    assert.equal(
      calculateDiscountAmount({
        discountType: "FIXED_AMOUNT",
        discountValue: 9_999_999,
        originalAmount: 100_000,
      }),
      100_000,
    );
    const quote = buildPromotionQuote({
      promotion: promo({
        id: "p1",
        code: "BIG",
        discountType: "FIXED_AMOUNT",
        discountValue: 9_999_999,
      }),
      originalAmount: 100_000,
      currency: "ARS",
    });
    assert.equal(quote.finalAmount, 0);
    assert.ok(quote.finalAmount >= 0);
  });
});

describe("previewPromotion", () => {
  const base = promo({
    id: "p1",
    code: "CLICKATON50",
    discountType: "PERCENTAGE",
    discountValue: 50,
  });

  it("accepts valid percentage code", () => {
    const r = previewPromotion({
      promotion: base,
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
      userId: 1,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.quote.discountAmount, 1_250_000);
      assert.equal(r.quote.finalAmount, 1_250_000);
    }
  });

  it("rejects expired", () => {
    const r = previewPromotion({
      promotion: {
        ...base,
        endsAt: new Date(Date.now() - 1000),
      },
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "CODE_EXPIRED");
  });

  it("rejects inactive", () => {
    const r = previewPromotion({
      promotion: { ...base, isActive: false },
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "CODE_INACTIVE");
  });

  it("rejects minimum purchase", () => {
    const r = previewPromotion({
      promotion: { ...base, minimumPurchaseAmount: 3_000_000 },
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "MINIMUM_NOT_MET");
  });

  it("rejects total usage limit", () => {
    const r = previewPromotion({
      promotion: { ...base, totalUsageLimit: 10 },
      usage: { totalActiveRedemptions: 10, userActiveRedemptions: 0 },
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "TOTAL_LIMIT_REACHED");
  });

  it("rejects per-user limit", () => {
    const r = previewPromotion({
      promotion: { ...base, perUserUsageLimit: 1 },
      usage: { totalActiveRedemptions: 1, userActiveRedemptions: 1 },
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
      userId: 7,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "USER_LIMIT_REACHED");
  });

  it("rejects edition mismatch", () => {
    const r = previewPromotion({
      promotion: base,
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "other",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "EDITION_MISMATCH");
  });

  it("applies fixed BIENVENIDA5000", () => {
    const r = previewPromotion({
      promotion: promo({
        id: "p2",
        code: "BIENVENIDA5000",
        discountType: "FIXED_AMOUNT",
        discountValue: 500_000,
      }),
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.quote.discountAmount, 500_000);
      assert.equal(r.quote.finalAmount, 2_000_000);
    }
  });
});

describe("buildRedeemCommand", () => {
  it("builds reserved redeem with idempotency key", () => {
    const r = buildRedeemCommand({
      promotion: promo({
        id: "p1",
        code: "CLICKATON50",
        discountType: "PERCENTAGE",
        discountValue: 50,
      }),
      usage: usageZero,
      originalAmount: 2_500_000,
      currency: "ARS",
      platform: "CLICKATON",
      editionId: "ed1",
      userId: 1,
      orderId: "reg_1",
      registrationId: "reg_1",
      idempotencyKey: "promo:reg_1:CLICKATON50",
    });
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "redeem") {
      assert.equal(r.command.status, "RESERVED");
      assert.equal(r.command.idempotencyKey, "promo:reg_1:CLICKATON50");
      assert.equal(r.command.discountAmount, 1_250_000);
    }
  });
});
