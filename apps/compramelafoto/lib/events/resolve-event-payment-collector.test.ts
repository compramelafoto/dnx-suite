import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ORGANIZER_FULL_COMMISSION_MP_REQUIRED_ERROR,
  resolveEventPaymentCollectorFromData,
} from "@/lib/events/resolve-event-payment-collector";
import { applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos } from "@/lib/event-organizer-commission-mp-marketplace-fee";
import { validateEventOrganizerCommissionMpSplit } from "@/lib/event-organizer-commission-mp-marketplace-fee";

const event100 = {
  id: 10,
  creatorId: 99,
  organizerCommissionEnabled: true,
  organizerCommissionPercentage: 100,
};

const event90 = {
  id: 11,
  creatorId: 99,
  organizerCommissionEnabled: true,
  organizerCommissionPercentage: 90,
};

describe("CLF-ORGANIZER-AS-COLLECTOR-100 — resolveEventPaymentCollectorFromData", () => {
  it("90% usa collector fotógrafo", () => {
    const r = resolveEventPaymentCollectorFromData({
      event: event90,
      photographerUserId: 5,
      photographerMpAccessToken: "photographer-token",
      organizerMpAccessToken: "organizer-token",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.collectorType, "PHOTOGRAPHER");
      assert.equal(r.accessToken, "photographer-token");
      assert.equal(r.organizerAsCollector, false);
      assert.equal(r.marketplaceFeePlatformOnlyMode, false);
    }
  });

  it("100% usa collector organizador si tiene MP", () => {
    const r = resolveEventPaymentCollectorFromData({
      event: event100,
      photographerUserId: 5,
      photographerMpAccessToken: "photographer-token",
      organizerMpAccessToken: "organizer-token",
      organizerMpUserId: "mp-org-1",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.collectorType, "ORGANIZER");
      assert.equal(r.collectorUserId, 99);
      assert.equal(r.accessToken, "organizer-token");
      assert.equal(r.organizerAsCollector, true);
      assert.equal(r.marketplaceFeePlatformOnlyMode, true);
    }
  });

  it("100% sin MP conectado falla con error claro", () => {
    const r = resolveEventPaymentCollectorFromData({
      event: event100,
      photographerUserId: 5,
      photographerMpAccessToken: "photographer-token",
      organizerMpAccessToken: null,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error, ORGANIZER_FULL_COMMISSION_MP_REQUIRED_ERROR);
      assert.equal(r.code, "ORGANIZER_MP_NOT_CONNECTED");
      assert.equal(r.automaticCheckoutBlocked, true);
    }
  });
});

describe("CLF-ORGANIZER-AS-COLLECTOR-100 — split MP", () => {
  it("100% organizador collector no genera marketplace_fee = total", () => {
    const total = 11_500;
    const split = applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos({
      orderId: 1,
      albumId: 1,
      eventId: 1,
      totalPaidPesos: total,
      extensionSurchargePesos: 0,
      platformPercent: 15,
      marketplaceFeePlatformOnlyPesos: 1_500,
      event: {
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: 100,
      },
      paymentCollectorType: "ORGANIZER",
    });
    assert.equal(split.marketplaceFeePesos, 1_500);
    assert.equal(split.amountToCollectorPesos, 10_000);
    assert.equal(split.amountToCollectorPesos, split.amountToPhotographerPesos);
    assert.notEqual(split.marketplaceFeePesos, total);
    const v = validateEventOrganizerCommissionMpSplit({
      totalPaidPesos: total,
      marketplaceFeePesos: split.marketplaceFeePesos,
      amountToCollectorPesos: split.amountToCollectorPesos,
    });
    assert.equal(v.valid, true);
  });

  it("90% fotógrafo collector mantiene retención en marketplace_fee", () => {
    const total = 11_500;
    const split = applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos({
      orderId: 1,
      albumId: 1,
      eventId: 1,
      totalPaidPesos: total,
      extensionSurchargePesos: 0,
      platformPercent: 15,
      marketplaceFeePlatformOnlyPesos: 1_500,
      event: {
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: 90,
      },
      paymentCollectorType: "PHOTOGRAPHER",
    });
    assert.equal(split.marketplaceFeePesos, 1_500 + 9_000);
    assert.equal(split.amountToCollectorPesos, 1_000);
    const v = validateEventOrganizerCommissionMpSplit({
      totalPaidPesos: total,
      marketplaceFeePesos: split.marketplaceFeePesos,
      amountToCollectorPesos: split.amountToCollectorPesos,
    });
    assert.equal(v.valid, true);
  });
});
