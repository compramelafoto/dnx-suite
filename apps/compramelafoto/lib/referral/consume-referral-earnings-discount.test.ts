import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planReferralDiscountConsumption } from "./consume-referral-earnings-discount";

const earnings = [
  { id: 1, referralAmountCents: 500 },
  { id: 2, referralAmountCents: 300 },
  { id: 3, referralAmountCents: 700 },
];

describe("planReferralDiscountConsumption", () => {
  it("no marca entera una comisión cubierta a medias: deja el resto pendiente", () => {
    assert.deepEqual(planReferralDiscountConsumption(earnings, 100), {
      fullyAppliedIds: [],
      partial: { id: 1, appliedCents: 100, remainingCents: 400 },
    });
  });

  it("aplica completas las que entran y parte la siguiente", () => {
    assert.deepEqual(planReferralDiscountConsumption(earnings, 1000), {
      fullyAppliedIds: [1, 2],
      partial: { id: 3, appliedCents: 200, remainingCents: 500 },
    });
  });

  it("descuento exacto: sin parte suelta", () => {
    assert.deepEqual(planReferralDiscountConsumption(earnings, 800), {
      fullyAppliedIds: [1, 2],
      partial: null,
    });
  });

  it("lo aplicado suma exactamente el descuento", () => {
    for (const discount of [1, 499, 500, 501, 799, 1499, 1500]) {
      const plan = planReferralDiscountConsumption(earnings, discount);
      const full = plan.fullyAppliedIds
        .map((id) => earnings.find((e) => e.id === id)!.referralAmountCents)
        .reduce((a, b) => a + b, 0);
      assert.equal(full + (plan.partial?.appliedCents ?? 0), Math.min(discount, 1500));
    }
  });

  it("descuento mayor al saldo: aplica todo, sin parte suelta", () => {
    assert.deepEqual(planReferralDiscountConsumption(earnings, 5000), {
      fullyAppliedIds: [1, 2, 3],
      partial: null,
    });
  });

  it("descuento cero o negativo no toca nada", () => {
    assert.deepEqual(planReferralDiscountConsumption(earnings, 0), { fullyAppliedIds: [], partial: null });
    assert.deepEqual(planReferralDiscountConsumption(earnings, -5), { fullyAppliedIds: [], partial: null });
  });
});
