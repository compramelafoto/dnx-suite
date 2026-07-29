/**
 * Verifica reglas de privacidad del ORIGINAL (sin I/O remota).
 * pnpm --filter fotorank exec tsx app/lib/fotorank/security/privacy-original.selfcheck.ts
 */
import assert from "node:assert/strict";
import { ROLE_ACCESS_MATRIX, assertMatrixDeniesOriginalForJury } from "./role-access-matrix";
import { JURY_FORBIDDEN_FIELD_NAMES, assertNoForbiddenJuryFields } from "../jury/serialize-entry-for-juror";
import { buildVersionedEntryStorageKey, storageKeyContainsPiiLeak } from "../storage/private-local-storage";

assertMatrixDeniesOriginalForJury();
assert.equal(ROLE_ACCESS_MATRIX.jury_assigned.asset_original?.access, "deny");
assert.equal(ROLE_ACCESS_MATRIX.visitor.asset_original?.access, "deny");
assert.equal(ROLE_ACCESS_MATRIX.participant_other.asset_original?.access, "deny");
assert.equal(ROLE_ACCESS_MATRIX.organizer_other.asset_original?.access, "deny");

const key = buildVersionedEntryStorageKey({
  contestId: "c1",
  entryId: "e1",
  versionNumber: 1,
  kind: "original",
  assetId: "a1",
});
assert.equal(storageKeyContainsPiiLeak(key), false);
assert.ok(!key.includes("@"));

const juryPayload = {
  anonymousCode: "SFE-E-1",
  technical: { width: 100, height: 100 },
  storageKey: "must-not",
};
assert.ok(assertNoForbiddenJuryFields(juryPayload).length > 0);
assert.ok(JURY_FORBIDDEN_FIELD_NAMES.includes("sha256"));

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "jury_denied_original",
        "visitor_denied_original",
        "cross_user_denied",
        "cross_org_denied",
        "storage_key_no_pii",
        "jury_payload_forbid_storageKey",
      ],
    },
    null,
    2,
  ),
);
console.log("privacy-original.selfcheck.ts OK");
