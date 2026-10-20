import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BIOMETRIC_CONSENT_VERSION } from "@/lib/legal/biometric-consent-content";
import { validateBiometricConsentField } from "@/lib/legal/biometric-consent-check";

describe("consentimiento biométrico de la selfie", () => {
  it("acepta la versión vigente", () => {
    assert.deepEqual(validateBiometricConsentField(BIOMETRIC_CONSENT_VERSION), { ok: true, version: "BIOMETRIC-v1.0" });
  });
  it("acepta con espacios alrededor", () => {
    assert.equal(validateBiometricConsentField(`  ${BIOMETRIC_CONSENT_VERSION} `).ok, true);
  });
  it("rechaza si falta, está vacío, es otra versión o no es texto", () => {
    for (const v of [undefined, null, "", "true", "on", "BIOMETRIC-v0.9", 1, true, {}]) {
      const r = validateBiometricConsentField(v);
      assert.equal(r.ok, false, String(v));
      if (!r.ok) assert.match(r.error, /Consentimiento biométrico/);
    }
  });
});
