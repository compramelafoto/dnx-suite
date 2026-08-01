import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardConsentRequired,
  cardNotEligible,
  cardNotFound,
  cardPhotoRequired,
  cardRateLimited,
  cardRegistrationInvalid,
  cardRenderUnavailable,
  cardUnauthorized,
  ClickatonCardError,
} from "../participant-card-errors";
import {
  cardErrorResponse,
  parseDisposition,
  parseMode,
  parseParticipantCardTypeParam,
  wantsJsonDiagnostic,
} from "../participant-card-http";

describe("parseParticipantCardTypeParam", () => {
  it("accepts canonical and alias values", () => {
    assert.equal(parseParticipantCardTypeParam("welcome"), "welcome");
    assert.equal(parseParticipantCardTypeParam("WELCOME"), "welcome");
    assert.equal(parseParticipantCardTypeParam("bienvenida"), "welcome");
    assert.equal(parseParticipantCardTypeParam(" member "), "member");
    assert.equal(parseParticipantCardTypeParam("soy-parte"), "member");
    assert.equal(parseParticipantCardTypeParam("miembro"), "member");
  });

  it("returns null for unknown types", () => {
    assert.equal(parseParticipantCardTypeParam(""), null);
    assert.equal(parseParticipantCardTypeParam("other"), null);
    assert.equal(parseParticipantCardTypeParam("welcome-card"), null);
  });
});

describe("parseDisposition", () => {
  it("reads inline and attachment from query", () => {
    assert.equal(
      parseDisposition(new URLSearchParams("disposition=inline"), "attachment"),
      "inline"
    );
    assert.equal(
      parseDisposition(new URLSearchParams("disposition=ATTACHMENT"), "inline"),
      "attachment"
    );
  });

  it("falls back when missing or invalid", () => {
    assert.equal(parseDisposition(new URLSearchParams(), "attachment"), "attachment");
    assert.equal(
      parseDisposition(new URLSearchParams("disposition=download"), "inline"),
      "inline"
    );
  });
});

describe("parseMode", () => {
  it("reads preview and final", () => {
    assert.equal(parseMode(new URLSearchParams("mode=preview"), "final"), "preview");
    assert.equal(parseMode(new URLSearchParams("mode=FINAL"), "preview"), "final");
  });

  it("falls back when missing or invalid", () => {
    assert.equal(parseMode(new URLSearchParams(), "final"), "final");
    assert.equal(parseMode(new URLSearchParams("mode=live"), "preview"), "preview");
  });
});

describe("wantsJsonDiagnostic", () => {
  it("detects application/json accept header", () => {
    const req = new Request("https://example.test/card", {
      headers: { Accept: "application/json" },
    });
    assert.equal(wantsJsonDiagnostic(req), true);
  });

  it("returns false for png-only accept", () => {
    const req = new Request("https://example.test/card", {
      headers: { Accept: "image/png" },
    });
    assert.equal(wantsJsonDiagnostic(req), false);
  });
});

describe("cardErrorResponse (mock-level mapping)", () => {
  async function body(res: Response) {
    return (await res.json()) as { ok: boolean; error: string; code: string };
  }

  it("maps ClickatonCardError to JSON with correct status", async () => {
    const cases: Array<{ err: ClickatonCardError; status: number }> = [
      { err: cardUnauthorized(), status: 401 },
      { err: cardNotFound(), status: 404 },
      { err: cardNotEligible("no elegible"), status: 409 },
      { err: cardPhotoRequired(), status: 422 },
      { err: cardConsentRequired(), status: 422 },
      { err: cardRegistrationInvalid("invalid"), status: 422 },
      { err: cardRenderUnavailable("busy"), status: 503 },
    ];

    for (const { err, status } of cases) {
      const res = cardErrorResponse(err);
      assert.equal(res.status, status, err.code);
      const json = await body(res);
      assert.equal(json.ok, false);
      assert.equal(json.code, err.code);
      assert.match(json.error, /.+/);
    }
  });

  it("adds Retry-After for rate limit", async () => {
    const res = cardErrorResponse(
      cardRateLimited("Demasiadas solicitudes", { retryAfterMs: 45_000 })
    );
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "45");
  });

  it("maps unknown errors to 500 render failed", async () => {
    const res = cardErrorResponse(new Error("boom"));
    assert.equal(res.status, 500);
    const json = await body(res);
    assert.equal(json.code, "CLICKATON_CARD_RENDER_FAILED");
  });
});
