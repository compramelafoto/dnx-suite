import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReferralProgram } from "@/lib/prisma";
import {
  computeEffectivePlatformFeeCents,
  computeReferralEarningAmounts,
  computeReferralEarningAmountsForProgram,
  computeReferralEarningsBreakdown,
} from "./referral-marketplace-fee";

const EFFECTIVE_FEE = 1_500;

describe("computeReferralEarningAmountsForProgram", () => {
  it("PHOTOGRAPHER_REFERRAL = 50% del fee efectivo", () => {
    const amounts = computeReferralEarningAmountsForProgram({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
    });
    assert.equal(amounts?.referralAmountCents, 750);
    assert.equal(amounts?.platformNetCents, 750);
  });

  it("ORGANIZER_REFERRAL = 20% del fee efectivo", () => {
    const amounts = computeReferralEarningAmountsForProgram({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      referralProgram: ReferralProgram.ORGANIZER_REFERRAL,
    });
    assert.equal(amounts?.referralAmountCents, 300);
    assert.equal(amounts?.platformNetCents, 1_200);
  });
});

describe("computeReferralEarningsBreakdown", () => {
  it("ambos programas suman 70% y CLF residual 30%", () => {
    const breakdown = computeReferralEarningsBreakdown({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      programs: [
        ReferralProgram.PHOTOGRAPHER_REFERRAL,
        ReferralProgram.ORGANIZER_REFERRAL,
      ],
    });
    assert.equal(breakdown?.totalReferralAmountCents, 1_050);
    assert.equal(breakdown?.platformNetResidualCents, 450);
  });

  it("solo fotógrafo referido", () => {
    const breakdown = computeReferralEarningsBreakdown({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      programs: [ReferralProgram.PHOTOGRAPHER_REFERRAL],
    });
    assert.equal(breakdown?.totalReferralAmountCents, 750);
    assert.equal(breakdown?.platformNetResidualCents, 750);
  });

  it("solo organizador referido", () => {
    const breakdown = computeReferralEarningsBreakdown({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      programs: [ReferralProgram.ORGANIZER_REFERRAL],
    });
    assert.equal(breakdown?.totalReferralAmountCents, 300);
    assert.equal(breakdown?.platformNetResidualCents, 1_200);
  });

  it("ningún programa devuelve null", () => {
    const breakdown = computeReferralEarningsBreakdown({
      effectivePlatformFeeCents: EFFECTIVE_FEE,
      programs: [],
    });
    assert.equal(breakdown, null);
  });
});

describe("computeReferralEarningAmounts (compatibilidad)", () => {
  it("mantiene 50% por defecto para fotógrafo", () => {
    const amounts = computeReferralEarningAmounts({
      grossPlatformFeeCents: 2_000,
      referralFeeDiscountCents: 500,
    });
    assert.equal(amounts?.effectivePlatformFeeCents, 1_500);
    assert.equal(amounts?.referralAmountCents, 750);
  });

  it("computeEffectivePlatformFeeCents retorna null si fee 0", () => {
    assert.equal(
      computeEffectivePlatformFeeCents({
        grossPlatformFeeCents: 100,
        referralFeeDiscountCents: 100,
      }),
      null
    );
  });
});
