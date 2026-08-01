import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasClickatonCardConsent } from "../participant-card-consent";

describe("hasClickatonCardConsent", () => {
  const base = {
    imageUsageConsent: false,
    acceptedImageAt: null,
    acceptedTermsAt: null,
    termsAcceptedAt: null,
  };

  it("returns true when imageUsageConsent is true", () => {
    assert.equal(hasClickatonCardConsent({ ...base, imageUsageConsent: true }), true);
  });

  it("returns true when acceptedImageAt is set", () => {
    assert.equal(
      hasClickatonCardConsent({ ...base, acceptedImageAt: new Date("2026-01-01") }),
      true
    );
  });

  it("returns true when termsAcceptedAt is set", () => {
    assert.equal(
      hasClickatonCardConsent({ ...base, termsAcceptedAt: new Date("2026-01-01") }),
      true
    );
  });

  it("returns true when acceptedTermsAt is set (legacy alias)", () => {
    assert.equal(
      hasClickatonCardConsent({ ...base, acceptedTermsAt: new Date("2026-01-01") }),
      true
    );
  });

  it("returns false when no proxy consent flags are set", () => {
    assert.equal(hasClickatonCardConsent(base), false);
  });
});
