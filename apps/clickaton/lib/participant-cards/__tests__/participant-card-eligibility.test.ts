import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateClickatonCardEligibility } from "../participant-card-eligibility";
import type { ParticipantCardRegistrationSnapshot } from "../participant-card-types";

function baseRegistration(
  overrides: Partial<ParticipantCardRegistrationSnapshot> = {}
): ParticipantCardRegistrationSnapshot {
  return {
    id: "reg-1",
    userId: 1,
    email: "a@example.com",
    firstName: "Ana",
    lastName: "López",
    city: "Rosario",
    province: "Santa Fe",
    country: "AR",
    instagramHandle: "@ana",
    instagramHandleNormalized: "ana",
    profilePhotoAssetId: "asset-1",
    profilePhotoStatus: "READY",
    visibleCode: "CT-0154",
    sequenceNumber: 154,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    imageUsageConsent: true,
    socialPublicationConsent: false,
    consentAcceptedAt: new Date("2026-01-01"),
    acceptedImageAt: new Date("2026-01-01"),
    acceptedTermsAt: new Date("2026-01-01"),
    termsAcceptedAt: new Date("2026-01-01"),
    termsVersion: "2026",
    ticketType: { name: "Profesional" },
    edition: {
      name: "Clickatón Rosario",
      slug: "rosario-2026",
      city: "Rosario",
      startAt: new Date("2026-09-19T15:00:00.000Z"),
      location: "Centro",
      timezone: "America/Argentina/Cordoba",
      coverImageUrl: null,
    },
    venue: { name: "Centro", city: "Rosario" },
    ...overrides,
  };
}

describe("evaluateClickatonCardEligibility", () => {
  it("allows confirmed + approved for participant final", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration(),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.blocked, false);
  });

  it("allows NOT_REQUIRED payment for complimentary", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({ paymentStatus: "NOT_REQUIRED" }),
      cardType: "member",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.eligible, true);
  });

  it("blocks cancelled registration for participant final", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({ status: "CANCELLED" }),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason ?? "", /CANCELLED/);
  });

  it("blocks pending payment for participant final", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({ status: "PENDING_PAYMENT" }),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.blocked, true);
  });

  it("blocks participant final without photo", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration(),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: false,
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason ?? "", /Foto/i);
  });

  it("blocks participant final without consent", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({ imageUsageConsent: false, acceptedImageAt: null, termsAcceptedAt: null, acceptedTermsAt: null }),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: false,
      hasPhoto: true,
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason ?? "", /Consentimiento/i);
  });

  it("allows admin preview with manual review warning", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({ paymentStatus: "MANUAL_REVIEW" }),
      cardType: "welcome",
      mode: "preview",
      actorKind: "admin",
      allowAdminPreview: true,
      hasConsent: false,
      hasPhoto: false,
    });
    assert.equal(result.eligible, true);
    assert.ok(result.warnings.some((w) => w.code === "PAYMENT_MANUAL_REVIEW"));
    assert.ok(result.warnings.some((w) => w.code === "CONSENT_MISSING"));
    assert.ok(result.warnings.some((w) => w.code === "PHOTO_PLACEHOLDER"));
  });

  it("requires event date for welcome participant final", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({
        edition: {
          ...baseRegistration().edition,
          startAt: null,
        },
      }),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.blocked, true);
    assert.match(result.blockReason ?? "", /Fecha del evento/i);
  });

  it("warns on member without event date but allows generation", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({
        edition: {
          ...baseRegistration().edition,
          startAt: null,
        },
      }),
      cardType: "member",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.eligible, true);
    assert.ok(result.warnings.some((w) => w.code === "EVENT_DATE_MISSING"));
  });

  it("warns when instagram is missing", () => {
    const result = evaluateClickatonCardEligibility({
      registration: baseRegistration({
        instagramHandle: null,
        instagramHandleNormalized: null,
      }),
      cardType: "welcome",
      mode: "final",
      actorKind: "participant",
      hasConsent: true,
      hasPhoto: true,
    });
    assert.equal(result.eligible, true);
    assert.ok(result.warnings.some((w) => w.code === "INSTAGRAM_MISSING"));
  });
});
