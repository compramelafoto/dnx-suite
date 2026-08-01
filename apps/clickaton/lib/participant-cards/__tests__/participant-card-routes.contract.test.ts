import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParticipantCardFilename,
  sanitizeParticipantCardFilenamePart,
} from "../participant-card-data";
import {
  cardConsentRequired,
  cardForbidden,
  cardNotEligible,
  cardNotFound,
  cardPhotoRequired,
  cardRateLimited,
  cardRegistrationInvalid,
  cardRenderFailed,
  cardRenderUnavailable,
  cardTemplateInvalid,
  cardUnauthorized,
} from "../participant-card-errors";
import {
  cardErrorResponse,
  parseDisposition,
  parseMode,
  parseParticipantCardTypeParam,
  wantsJsonDiagnostic,
} from "../participant-card-http";
import type { ParticipantCardRegistrationSnapshot } from "../participant-card-types";

function makeRegistration(
  overrides: Partial<ParticipantCardRegistrationSnapshot> = {}
): ParticipantCardRegistrationSnapshot {
  return {
    id: "reg-contract-test",
    userId: 1,
    email: "contract@example.com",
    firstName: "Ana",
    lastName: "Test",
    city: "Rosario",
    province: "Santa Fe",
    country: "AR",
    instagramHandle: "anatest",
    instagramHandleNormalized: "anatest",
    profilePhotoAssetId: "asset-1",
    profilePhotoStatus: "READY",
    visibleCode: "CT-0042",
    sequenceNumber: 42,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    imageUsageConsent: true,
    socialPublicationConsent: true,
    consentAcceptedAt: new Date("2026-08-01"),
    acceptedImageAt: new Date("2026-08-01"),
    acceptedTermsAt: new Date("2026-08-01"),
    termsAcceptedAt: new Date("2026-08-01"),
    termsVersion: "2026",
    ticketType: { name: "General" },
    edition: {
      name: "Clickatón Test",
      slug: "test",
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

describe("route contract — parse helpers", () => {
  it("cardType aliases round-trip", () => {
    for (const raw of ["welcome", "bienvenida", "member", "soy-parte", "miembro"]) {
      assert.ok(parseParticipantCardTypeParam(raw));
    }
    assert.equal(parseParticipantCardTypeParam("invalid"), null);
  });

  it("disposition and mode defaults match route handlers", () => {
    const empty = new URLSearchParams();
    assert.equal(parseDisposition(empty, "attachment"), "attachment");
    assert.equal(parseDisposition(empty, "inline"), "inline");
    assert.equal(parseMode(empty, "final"), "final");
    assert.equal(parseMode(empty, "preview"), "preview");
  });

  it("json diagnostic requires explicit accept", () => {
    assert.equal(
      wantsJsonDiagnostic(
        new Request("https://x.test", { headers: { Accept: "text/html, */*" } })
      ),
      false
    );
    assert.equal(
      wantsJsonDiagnostic(
        new Request("https://x.test", {
          headers: { Accept: "text/html, application/json;q=0.9" },
        })
      ),
      true
    );
  });
});

describe("route contract — cardErrorResponse HTTP codes", () => {
  const matrix: Array<{
    name: string;
    factory: () => ReturnType<typeof cardNotFound>;
    status: number;
    code: string;
  }> = [
    { name: "401 unauthorized", factory: cardUnauthorized, status: 401, code: "CLICKATON_CARD_UNAUTHORIZED" },
    { name: "403 forbidden", factory: cardForbidden, status: 403, code: "CLICKATON_CARD_FORBIDDEN" },
    { name: "404 not found", factory: cardNotFound, status: 404, code: "CLICKATON_CARD_NOT_FOUND" },
    {
      name: "409 not eligible",
      factory: () => cardNotEligible("Inscripción no confirmada"),
      status: 409,
      code: "CLICKATON_CARD_NOT_ELIGIBLE",
    },
    {
      name: "422 photo required",
      factory: cardPhotoRequired,
      status: 422,
      code: "CLICKATON_CARD_PHOTO_REQUIRED",
    },
    {
      name: "422 consent required",
      factory: cardConsentRequired,
      status: 422,
      code: "CLICKATON_CARD_CONSENT_REQUIRED",
    },
    {
      name: "422 registration invalid",
      factory: () => cardRegistrationInvalid("Datos inválidos"),
      status: 422,
      code: "CLICKATON_CARD_REGISTRATION_INVALID",
    },
    {
      name: "422 template invalid",
      factory: () => cardTemplateInvalid("Tipo inválido"),
      status: 422,
      code: "CLICKATON_CARD_TEMPLATE_INVALID",
    },
    {
      name: "503 render unavailable",
      factory: () => cardRenderUnavailable("Chromium busy"),
      status: 503,
      code: "CLICKATON_CARD_RENDER_UNAVAILABLE",
    },
  ];

  for (const row of matrix) {
    it(row.name, async () => {
      const res = cardErrorResponse(row.factory());
      assert.equal(res.status, row.status);
      const json = (await res.json()) as { ok: boolean; code: string };
      assert.equal(json.ok, false);
      assert.equal(json.code, row.code);
    });
  }

  it("429 rate limited with Retry-After default", async () => {
    const res = cardErrorResponse(cardRateLimited());
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "60");
  });

  it("500 render failed for generic ClickatonCardError code", async () => {
    const res = cardErrorResponse(cardRenderFailed("timeout"));
    assert.equal(res.status, 500);
    const json = (await res.json()) as { code: string };
    assert.equal(json.code, "CLICKATON_CARD_RENDER_FAILED");
  });
});

describe("route contract — filename sanitization", () => {
  it("buildParticipantCardFilename uses safe parts", () => {
    const reg = makeRegistration({ sequenceNumber: 7 });
    assert.equal(
      buildParticipantCardFilename("welcome", reg),
      "clickaton-bienvenida-0007.png"
    );
    assert.equal(
      buildParticipantCardFilename("member", reg),
      "clickaton-soy-parte-0007.png"
    );
  });

  it("sanitizeParticipantCardFilenamePart strips unsafe characters", () => {
    const reg = makeRegistration({
      sequenceNumber: null,
      visibleCode: "CT-@#$99",
    });
    assert.equal(sanitizeParticipantCardFilenamePart(reg), "99");

    const weird = makeRegistration({
      sequenceNumber: null,
      visibleCode: null,
      id: "abc!!!def???ghi",
    });
    const part = sanitizeParticipantCardFilenamePart(weird);
    assert.match(part, /^[a-zA-Z0-9_-]+$/);
    assert.ok(part.length <= 8);
  });
});
