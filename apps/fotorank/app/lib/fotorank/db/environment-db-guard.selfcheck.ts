/**
 * Selfcheck guard DB Preview/Production (ETAPA 11B).
 *   pnpm --filter fotorank run test:db:environment-guard
 */
import {
  assertEnvironmentDatabaseIdentity,
  hostLooksLikeProduction,
  hostLooksLikeStaging,
} from "./environment-db-guard";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

const stagingUrl = "postgresql://u:p@ep-round-fog-a4xgibtv-pooler.us-east-1.aws.neon.tech/neondb";
const prodUrl = "postgresql://u:p@ep-dawn-dew-adyr8f1v-pooler.c-2.us-east-1.aws.neon.tech/neondb";
const clfUrl = "postgresql://u:p@ep-xxx-compramelafoto-prod.us-east-1.aws.neon.tech/neondb";

assert(hostLooksLikeStaging("ep-round-fog-a4xgibtv-pooler"), "staging host hint");
assert(hostLooksLikeProduction("ep-dawn-dew-adyr8f1v-pooler"), "production host hint");

assert(
  assertEnvironmentDatabaseIdentity({ vercelEnv: "preview", databaseUrl: stagingUrl }).ok,
  "preview + staging OK",
);
assert(
  !assertEnvironmentDatabaseIdentity({ vercelEnv: "preview", databaseUrl: prodUrl }).ok,
  "preview + production DENIED",
);
assert(
  !assertEnvironmentDatabaseIdentity({ vercelEnv: "preview", databaseUrl: clfUrl }).ok,
  "preview + CLF DENIED",
);
assert(
  assertEnvironmentDatabaseIdentity({ vercelEnv: "production", databaseUrl: prodUrl }).ok,
  "production + dawn-dew OK",
);
assert(
  !assertEnvironmentDatabaseIdentity({ vercelEnv: "production", databaseUrl: stagingUrl }).ok,
  "production + staging DENIED",
);

const previewFail = assertEnvironmentDatabaseIdentity({
  vercelEnv: "preview",
  databaseUrl: prodUrl,
});
assert(!previewFail.ok && previewFail.reason === "PREVIEW_DATABASE_PRODUCTION_DENIED", "reason preview prod");

const prodFail = assertEnvironmentDatabaseIdentity({
  vercelEnv: "production",
  databaseUrl: stagingUrl,
});
assert(!prodFail.ok && prodFail.reason === "PRODUCTION_DATABASE_STAGING_DENIED", "reason prod staging");

console.log("FINAL: PASS");
