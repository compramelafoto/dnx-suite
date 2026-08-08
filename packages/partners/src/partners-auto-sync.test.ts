import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPartnerBenefitSyncEventKey } from "./auto-sync-event-key";
import {
  resolveAffectedBenefitsForPaymentEvent,
  resolveAffectedBenefitsForRegistrationEvent,
  resolveAffectedBenefitsForWinnerEvent,
  resolveAffectedBenefitsFromPayload,
  resolveAffectedSubjectsForBenefitChange,
} from "./auto-sync-scope";
import type { BenefitAudienceScopeHint } from "./auto-sync-types";

const hints: BenefitAudienceScopeHint[] = [
  {
    benefitId: "b-part",
    audienceKeys: ["EDITION_PARTICIPANTS"],
    categoryIds: [],
    prizeBundleIds: [],
    application: "CLICKATON",
  },
  {
    benefitId: "b-buy",
    audienceKeys: ["PRODUCT_PURCHASERS"],
    categoryIds: [],
    prizeBundleIds: [],
    application: "CLICKATON",
  },
  {
    benefitId: "b-cat",
    audienceKeys: ["CATEGORY"],
    categoryIds: ["cat-a"],
    prizeBundleIds: [],
    application: "CLICKATON",
  },
  {
    benefitId: "b-win",
    audienceKeys: ["WINNERS"],
    categoryIds: [],
    prizeBundleIds: [],
    application: "CLICKATON",
  },
  {
    benefitId: "b-bundle",
    audienceKeys: ["PRIZE_BUNDLE_WINNERS"],
    categoryIds: [],
    prizeBundleIds: ["bundle-a"],
    application: "CLICKATON",
  },
];

describe("auto-sync event keys", () => {
  it("son estables e idempotentes", () => {
    const a = buildPartnerBenefitSyncEventKey({
      eventType: "CLICKATON_REGISTRATION_CONFIRMED",
      occurredAt: "2026-01-01T00:00:00.000Z",
      editionId: "ed1",
      registrationId: "r1",
      versionToken: "confirmed",
    });
    const b = buildPartnerBenefitSyncEventKey({
      eventType: "CLICKATON_REGISTRATION_CONFIRMED",
      occurredAt: "2026-01-02T00:00:00.000Z",
      editionId: "ed1",
      registrationId: "r1",
      versionToken: "confirmed",
    });
    assert.equal(a, b);
    assert.match(a, /registration-confirmed:r1:confirmed/);
  });

  it("ganador: slug:prizeAssignmentId:versionToken (sin registrationId)", () => {
    const key = buildPartnerBenefitSyncEventKey({
      eventType: "CLICKATON_WINNER_CONFIRMED",
      occurredAt: "2026-01-01T00:00:00.000Z",
      editionId: "ed1",
      prizeAssignmentId: "pa-1",
      registrationId: "reg-should-not-appear",
      versionToken: "v3",
    });
    assert.equal(key, "winner-confirmed:pa-1:v3");
    assert.ok(!key.includes("reg-should-not-appear"));
  });
});

describe("auto-sync scope", () => {
  it("inscripción confirmada incluye participantes y compradores", () => {
    const r = resolveAffectedBenefitsForRegistrationEvent({
      eventType: "CLICKATON_REGISTRATION_CONFIRMED",
      editionId: "ed1",
      hints,
    });
    assert.ok(r.benefitIds.includes("b-part"));
    assert.ok(r.benefitIds.includes("b-buy"));
    assert.ok(r.benefitIds.includes("b-win"));
  });

  it("pago solo compradores", () => {
    const r = resolveAffectedBenefitsForPaymentEvent({
      eventType: "CLICKATON_PAYMENT_CONFIRMED",
      editionId: "ed1",
      hints,
    });
    assert.deepEqual(r.benefitIds, ["b-buy"]);
  });

  it("categoría anterior y nueva", () => {
    const r = resolveAffectedBenefitsForRegistrationEvent({
      eventType: "CLICKATON_REGISTRATION_CATEGORY_CHANGED",
      editionId: "ed1",
      hints,
      categoryId: "cat-a",
      previousCategoryId: "cat-b",
    });
    assert.ok(r.benefitIds.includes("b-cat"));
    assert.ok(r.benefitIds.includes("b-part"));
  });

  it("ganador solo WINNERS", () => {
    const r = resolveAffectedBenefitsForWinnerEvent({
      eventType: "CLICKATON_WINNER_CONFIRMED",
      editionId: "ed1",
      hints,
      prizeBundleId: "bundle-other",
    });
    assert.deepEqual(r.benefitIds, ["b-win"]);
  });

  it("filtra PRIZE_BUNDLE_WINNERS por prizeBundleId", () => {
    const r = resolveAffectedBenefitsForWinnerEvent({
      eventType: "CLICKATON_WINNER_CONFIRMED",
      editionId: "ed1",
      hints: [
        hints.find((h) => h.benefitId === "b-bundle")!,
        {
          benefitId: "b-bundle-other",
          audienceKeys: ["PRIZE_BUNDLE_WINNERS"],
          categoryIds: [],
          prizeBundleIds: ["bundle-b"],
          application: "CLICKATON",
        },
      ],
      prizeBundleId: "bundle-a",
    });
    assert.deepEqual(r.benefitIds, ["b-bundle"]);
  });

  it("cambio de beneficio → solo ese id", () => {
    const r = resolveAffectedSubjectsForBenefitChange({
      eventType: "PARTNER_BENEFIT_ACTIVATED",
      editionId: "ed1",
      benefitId: "b-only",
    });
    assert.deepEqual(r.benefitIds, ["b-only"]);
  });

  it("despacho desde payload", () => {
    const r = resolveAffectedBenefitsFromPayload({
      payload: {
        eventType: "CLICKATON_PAYMENT_REVERSED",
        occurredAt: new Date().toISOString(),
        editionId: "ed1",
        registrationId: "r1",
      },
      hints,
    });
    assert.deepEqual(r.benefitIds, ["b-buy"]);
  });

  it("no incluye beneficios no relacionados en pago", () => {
    const r = resolveAffectedBenefitsForPaymentEvent({
      eventType: "CLICKATON_PAYMENT_CONFIRMED",
      editionId: "ed1",
      hints: [hints[0]!],
    });
    assert.equal(r.benefitIds.length, 0);
  });
});
