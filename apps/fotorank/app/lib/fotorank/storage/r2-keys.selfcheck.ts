/**
 * Selfcheck local de keys + denylist (sin red / sin R2).
 * pnpm --filter fotorank run test:storage:r2-keys
 */
import assert from "node:assert/strict";
import { buildEntryStorageKey, canAccessEntryAsset } from "./contest-entry-storage";
import {
  assertProductionR2Isolation,
  assertStagingBucketSafe,
  buildSmokeObjectKey,
  buildSmokePrefix,
  buildSyntheticSmokePng,
  isProductionDeniedBucket,
  isStagingOnlyBucket,
  sha256Hex,
} from "./r2-staging-preflight";

const key = buildEntryStorageKey({
  contestId: "c_test",
  registrationId: "r_test",
  entryId: "e_test",
  kind: "ORIGINAL",
});
assert.equal(key, "fotorank/contests/c_test/registrations/r_test/entries/e_test/original");
assert.ok(!key.includes("@"));
assert.ok(!/dni|instagram|email/i.test(key));

const smoke = buildSmokeObjectKey("exec_abc");
assert.ok(smoke.startsWith("_internal/smoke-tests/exec_abc/"));
assert.equal(buildSmokePrefix("exec_abc"), "_internal/smoke-tests/exec_abc");

assert.equal(isProductionDeniedBucket("fotorank-uploads"), true);
assert.equal(isProductionDeniedBucket("compramelafoto-prod"), true);
assert.equal(isProductionDeniedBucket("clickaton-media"), true);
assert.equal(isProductionDeniedBucket("fotorank-private-staging"), false);
assert.throws(() => assertStagingBucketSafe("fotorank-uploads"));
assert.throws(() => assertStagingBucketSafe("compramelafoto-prod"));
assert.doesNotThrow(() => assertStagingBucketSafe("fotorank-private-staging"));

assert.equal(isStagingOnlyBucket("fotorank-private-staging"), true);
assert.equal(isStagingOnlyBucket("fotorank-uploads"), false);
assert.throws(() =>
  assertProductionR2Isolation({ vercelEnv: "production", bucket: "fotorank-private-staging" }),
);
assert.doesNotThrow(() =>
  assertProductionR2Isolation({ vercelEnv: "preview", bucket: "fotorank-private-staging" }),
);
assert.doesNotThrow(() =>
  assertProductionR2Isolation({ vercelEnv: "production", bucket: "fotorank-uploads" }),
);

const png = buildSyntheticSmokePng("x");
assert.ok(png.byteLength > 20);
assert.equal(png[0], 0x89);
assert.equal(png[1], 0x50); // P
const h = sha256Hex(png);
assert.equal(h.length, 64);

const ctx = {
  contestId: "c1",
  registrationId: "r1",
  registrationParticipantUserId: 7,
  contestOrganizationId: "org1",
  kind: "ORIGINAL" as const,
};
assert.equal(
  canAccessEntryAsset({ role: "participant", userId: 7, registrationId: "r1", contestId: "c1" }, ctx),
  true,
);
assert.equal(
  canAccessEntryAsset({ role: "participant", userId: 8, registrationId: "r1", contestId: "c1" }, ctx),
  false,
);
assert.equal(
  canAccessEntryAsset({ role: "organizer", userId: 1, organizationId: "org-other", contestId: "c1" }, ctx),
  false,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "entry_key_shape",
        "smoke_prefix",
        "production_denylist",
        "production_r2_isolation",
        "synthetic_png_no_network",
        "ownership_matrix_sample",
      ],
    },
    null,
    2,
  ),
);
console.log("r2-keys.selfcheck.ts OK");
