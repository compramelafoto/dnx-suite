import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClickatonParticipantTemplateData,
  buildParticipantCardFilename,
  sanitizeParticipantCardFilenamePart,
} from "../participant-card-data";
import type { ParticipantCardRegistrationSnapshot } from "../participant-card-types";

const PHOTO = "data:image/png;base64,abc123";

function makeRegistration(
  overrides: Partial<ParticipantCardRegistrationSnapshot> = {}
): ParticipantCardRegistrationSnapshot {
  return {
    id: "reg-demo",
    userId: 1,
    email: "demo@example.com",
    firstName: "Daniel",
    lastName: "Fotógrafo",
    city: "Rosario",
    province: "Santa Fe",
    country: "AR",
    instagramHandle: "dnxfotografia",
    instagramHandleNormalized: "dnxfotografia",
    profilePhotoAssetId: "asset-1",
    profilePhotoStatus: "READY",
    visibleCode: "CT-0154",
    sequenceNumber: 154,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    imageUsageConsent: true,
    socialPublicationConsent: false,
    consentAcceptedAt: new Date("2026-08-01"),
    acceptedImageAt: new Date("2026-08-01"),
    acceptedTermsAt: new Date("2026-08-01"),
    termsAcceptedAt: new Date("2026-08-01"),
    termsVersion: "2026",
    ticketType: { name: "Profesional" },
    edition: {
      name: "Clickatón Rosario",
      slug: "clickaton-rosario-2026",
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

describe("buildClickatonParticipantTemplateData", () => {
  it("maps registration fields using clickaton formatters", () => {
    const data = buildClickatonParticipantTemplateData({
      registration: makeRegistration(),
      photoDataUrl: PHOTO,
    });

    const participant = data.participant as Record<string, unknown>;
    assert.equal(participant.fullName, "Daniel Fotógrafo");
    assert.equal(participant.displayName, "DANIEL FOTÓGRAFO");
    assert.equal(participant.instagramHandle, "@dnxfotografia");
    assert.equal(participant.numberFormatted, "0154");
    assert.equal(participant.photoUrl, PHOTO);
    assert.equal(participant.category, "Profesional");

    const edition = data.edition as Record<string, unknown>;
    assert.equal(edition.name, "Clickatón Rosario");
    assert.equal(edition.eventDateFormatted, "19 DE SEPTIEMBRE");
    assert.equal(data["participant.fullName"], "Daniel Fotógrafo");
  });

  it("leaves instagram empty when invalid", () => {
    const data = buildClickatonParticipantTemplateData({
      registration: makeRegistration({
        instagramHandle: "!!!",
        instagramHandleNormalized: null,
      }),
      photoDataUrl: PHOTO,
    });
    const participant = data.participant as Record<string, unknown>;
    assert.equal(participant.instagramHandle, "");
    assert.equal(participant.instagram, "");
  });
});

describe("filename helpers", () => {
  it("uses padded sequenceNumber", () => {
    assert.equal(sanitizeParticipantCardFilenamePart(makeRegistration()), "0154");
    assert.equal(
      buildParticipantCardFilename("welcome", makeRegistration()),
      "clickaton-bienvenida-0154.png"
    );
    assert.equal(
      buildParticipantCardFilename("member", makeRegistration()),
      "clickaton-soy-parte-0154.png"
    );
  });

  it("falls back to visibleCode digits or sanitized id", () => {
    const reg = makeRegistration({ sequenceNumber: null, visibleCode: "CT-99" });
    assert.equal(sanitizeParticipantCardFilenamePart(reg), "99");
    const empty = makeRegistration({
      sequenceNumber: null,
      visibleCode: null,
      id: "abcdefghijklmnop",
    });
    assert.equal(sanitizeParticipantCardFilenamePart(empty), "abcdefgh");
  });
});
