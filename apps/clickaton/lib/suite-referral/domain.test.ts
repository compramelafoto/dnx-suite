import assert from "node:assert/strict";
import test from "node:test";

import {
  suiteReferralCodeFromAuditMetadata,
  suiteReferralCodeToReport,
} from "./domain";

test("sólo se reporta un alta recién creada con código válido", () => {
  assert.equal(suiteReferralCodeToReport({ created: true, code: " abc123 " }), "ABC123");
  assert.equal(suiteReferralCodeToReport({ created: false, code: "ABC123" }), null);
  assert.equal(suiteReferralCodeToReport({ created: true, code: null }), null);
  assert.equal(suiteReferralCodeToReport({ created: true, code: "no válido!" }), null);
});

test("el código se lee del metadata de la auditoría", () => {
  assert.equal(suiteReferralCodeFromAuditMetadata({ code: "dnx42" }), "DNX42");
  assert.equal(suiteReferralCodeFromAuditMetadata({ otro: "x" }), null);
  assert.equal(suiteReferralCodeFromAuditMetadata(null), null);
  assert.equal(suiteReferralCodeFromAuditMetadata(["DNX42"]), null);
  assert.equal(suiteReferralCodeFromAuditMetadata("DNX42"), null);
});
