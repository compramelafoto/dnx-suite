/**
 * Guardas del identity script: sin fallback a DATABASE_URL.
 * No abre conexiones reales.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(pkgRoot, "scripts/communications-db-identity.mts");

function runIdentity(env: NodeJS.ProcessEnv): {
  status: number | null;
  stdout: string;
} {
  const result = spawnSync("pnpm", ["exec", "tsx", script], {
    cwd: pkgRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

describe("communications:db:identity", () => {
  it("FAIL without COMMUNICATIONS_STAGING_DATABASE_URL even if DATABASE_URL set", () => {
    const { status, stdout } = runIdentity({
      COMMUNICATIONS_STAGING_DATABASE_URL: "",
      DATABASE_URL: "postgresql://u:p@ep-dawn-dew-xxxx.aws.neon.tech/neondb",
      DIRECT_URL: "postgresql://u:p@ep-dawn-dew-xxxx.aws.neon.tech/neondb",
    });
    assert.notEqual(status, 0);
    assert.match(stdout, /COMMUNICATIONS_STAGING_DATABASE_URL/);
    assert.doesNotMatch(stdout, /ep-dawn-dew-xxxx/);
    assert.doesNotMatch(stdout, /:p@/);
  });

  it("FAIL on production denylist host via explicit staging var", () => {
    const { status, stdout } = runIdentity({
      COMMUNICATIONS_STAGING_DATABASE_URL:
        "postgresql://u:p@ep-dawn-dew-adyr8f1v.aws.neon.tech/neondb",
      COMMUNICATIONS_EXPECTED_DATABASE_ENV: "staging",
      COMMUNICATIONS_EXPECTED_HOST_PREFIX: "ep-round-fog",
      COMMUNICATIONS_EXPECTED_DATABASE_NAME: "neondb",
    });
    assert.notEqual(status, 0);
    assert.match(stdout, /FAIL|production|denylist|host_mismatch/i);
    assert.doesNotMatch(stdout, /:p@/);
  });
});
