import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSignupReferralInput } from "./resolve-signup-referral-input";

function reqWithCookie(cookie?: string): Request {
  return new Request("https://www.compramelafoto.com/api/auth/register-photographer", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });
}

describe("resolveSignupReferralInput", () => {
  it("usa el ref del body cuando viene", () => {
    const out = resolveSignupReferralInput(reqWithCookie("clf_ref=COOKIE12"), {
      ref: "BODY1234",
    });
    assert.equal(out.refCode, "BODY1234");
  });

  it("cae a la cookie clf_ref cuando el formulario no manda ref", () => {
    const out = resolveSignupReferralInput(reqWithCookie("clf_ref=COOKIE12"), {});
    assert.equal(out.refCode, "COOKIE12");
  });

  it("cae a la cookie cuando el body manda ref vacío", () => {
    const out = resolveSignupReferralInput(reqWithCookie("clf_ref=COOKIE12"), { ref: "  " });
    assert.equal(out.refCode, "COOKIE12");
  });

  it("devuelve string vacío si no hay ref por ningún lado", () => {
    const out = resolveSignupReferralInput(reqWithCookie(), {});
    assert.equal(out.refCode, "");
  });

  it("toma el origen TRAINING de la cookie clf_ref_meta", () => {
    const meta = encodeURIComponent(
      JSON.stringify({ sourceType: "TRAINING", sourceEntityId: 7 })
    );
    const out = resolveSignupReferralInput(
      reqWithCookie(`clf_ref=COOKIE12; clf_ref_meta=${meta}`),
      {}
    );
    assert.equal(out.sourceTypeRaw, "TRAINING");
    assert.equal(out.sourceEntityRaw, 7);
  });

  it("el origen del body gana sobre la cookie", () => {
    const meta = encodeURIComponent(
      JSON.stringify({ sourceType: "TRAINING", sourceEntityId: 7 })
    );
    const out = resolveSignupReferralInput(
      reqWithCookie(`clf_ref=COOKIE12; clf_ref_meta=${meta}`),
      { ref: "BODY1234", sourceType: "TRAINING", sourceEntityId: 99 }
    );
    assert.equal(out.sourceEntityRaw, 99);
  });
});
