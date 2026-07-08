import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_EVENT_ORGANIZER_COMMISSION_PERCENT,
  MAX_ORGANIZER_COMMISSION_PERCENT,
  resolveEventOrganizerCommissionForCreate,
  resolveEventOrganizerCommissionForPatch,
} from "@/lib/event-organizer-commission";
import { closeCheckoutFinancials } from "@/lib/pricing/checkout-fee-financial-close";

describe("CLF-ORGANIZER-COMMISSION-100 — tope de comisión", () => {
  it("constante centralizada en 100", () => {
    assert.equal(MAX_ORGANIZER_COMMISSION_PERCENT, 100);
    assert.equal(MAX_EVENT_ORGANIZER_COMMISSION_PERCENT, 100);
  });

  it("acepta 90% y 100% al crear evento", () => {
    for (const pct of [90, 100]) {
      const r = resolveEventOrganizerCommissionForCreate({
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: pct,
      });
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.value.enabled, true);
        assert.equal(r.value.percentage, pct);
      }
    }
  });

  it("rechaza 101% al crear evento", () => {
    const r = resolveEventOrganizerCommissionForCreate({
      organizerCommissionEnabled: true,
      organizerCommissionPercentage: 101,
    });
    assert.equal(r.ok, false);
  });

  it("acepta 100% en PATCH", () => {
    const r = resolveEventOrganizerCommissionForPatch(
      { organizerCommissionEnabled: true, organizerCommissionPercentage: 50 },
      { organizerCommissionPercentage: 100 }
    );
    assert.equal(r.ok, true);
    if (r.ok && "value" in r) {
      assert.equal(r.value.percentage, 100);
    }
  });
});

describe("CLF-ORGANIZER-AS-COLLECTOR-100 — cierre financiero", () => {
  it("EVENT_ORGANIZER al 100% — organizador cobra neto, fee solo plataforma", () => {
    const r = closeCheckoutFinancials({
      scenario: "EVENT_ORGANIZER",
      marketplaceFeePercent: 15,
      eventOrganizerPercent: 100,
    });
    assert.equal(r.organizerEventArs, 10_000);
    assert.equal(r.collectorNetAmountPesos, 10_000);
    assert.equal(r.photographerMpArs, r.collectorNetAmountPesos);
    assert.equal(r.marketplaceFeeMpArs, 1_500);
    assert.equal(r.closesExactly, true);
  });
});
