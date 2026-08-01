import { CLICKATON_FIXTURE_PHOTO_DATA_URL } from "@repo/template-engine";
import type { ParticipantCardRegistrationSnapshot } from "../participant-card-types";

export function mockParticipantCardRegistration(
  overrides: Partial<ParticipantCardRegistrationSnapshot & { editionId: string }> = {}
): ParticipantCardRegistrationSnapshot & { editionId: string } {
  const startAt = new Date("2026-09-15T15:00:00.000Z");
  return {
    id: "reg_test_001",
    editionId: "edition_test_001",
    userId: 42,
    email: "participante@test.local",
    firstName: "Ana",
    lastName: "Foto",
    city: "Buenos Aires",
    province: "CABA",
    country: "AR",
    instagramHandle: "@anafoto",
    instagramHandleNormalized: "anafoto",
    profilePhotoAssetId: null,
    profilePhotoStatus: "APPROVED",
    visibleCode: "0042",
    sequenceNumber: 42,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    consentAcceptedAt: startAt,
    acceptedImageAt: startAt,
    acceptedTermsAt: startAt,
    termsAcceptedAt: startAt,
    termsVersion: "2026-01",
    ticketType: { name: "General" },
    edition: {
      name: "Clickatón Buenos Aires 2026",
      slug: "ba-2026",
      city: "Buenos Aires",
      startAt,
      location: "Centro Cultural",
      timezone: "America/Argentina/Buenos_Aires",
      coverImageUrl: null,
    },
    venue: { name: "Centro Cultural", city: "Buenos Aires" },
    ...overrides,
  };
}

export const MOCK_PHOTO_DATA_URL = CLICKATON_FIXTURE_PHOTO_DATA_URL;

export function mockFixedPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}
