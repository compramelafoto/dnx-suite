/**
 * Selfcheck del production guard R2 (sin red / sin secretos).
 * pnpm --filter fotorank run test:storage:r2-production-guard
 */
import assert from "node:assert/strict";
import {
  assertProductionR2Isolation,
  assertStagingBucketSafe,
  FOTORANK_R2_STAGING_BUCKET_EXPECTED,
  isProductionDeniedBucket,
  isStagingOnlyBucket,
} from "./r2-staging-preflight";

assert.equal(FOTORANK_R2_STAGING_BUCKET_EXPECTED, "fotorank-private-staging");
assert.equal(isStagingOnlyBucket("fotorank-private-staging"), true);
assert.equal(isProductionDeniedBucket("compramelafoto-prod"), true);

assert.throws(
  () => assertProductionR2Isolation({ vercelEnv: "production", bucket: "fotorank-private-staging" }),
  /staging/,
);
assert.throws(
  () => assertProductionR2Isolation({ vercelEnv: "production", bucket: "my-app-staging" }),
  /staging/,
);
assert.doesNotThrow(() =>
  assertProductionR2Isolation({ vercelEnv: "preview", bucket: "fotorank-private-staging" }),
);
assert.doesNotThrow(() => assertProductionR2Isolation({ vercelEnv: undefined, bucket: "fotorank-private-staging" }));
assert.doesNotThrow(() => assertStagingBucketSafe("fotorank-private-staging"));
assert.throws(() => assertStagingBucketSafe("compramelafoto-prod"));

// Simula que Production no debe aceptar denylist buckets como "seguros" para staging smoke.
assert.equal(isProductionDeniedBucket("fotorank-private-staging"), false);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "production_cannot_use_staging_bucket",
        "preview_can_use_staging_bucket",
        "denylist_blocks_clf_prod",
        "staging_bucket_name_canonical",
      ],
    },
    null,
    2,
  ),
);
console.log("r2-production-guard.selfcheck.ts OK");
