/**
 * Identity guard de DB staging — NO usa DATABASE_URL.
 *
 *   COMMUNICATIONS_STAGING_DATABASE_URL="…" \
 *   COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging \
 *   COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog \
 *   COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb \
 *   pnpm --filter @repo/db communications:db:identity
 *
 * No escribe a disco. No imprime password. No modifica .env.
 */
import { PrismaClient } from "@prisma/client";

type ClassifyFn = (raw: string | undefined) => {
  classification: string;
  safeForTestSmoke: boolean;
  reason: string;
};

async function loadClassifier(): Promise<ClassifyFn> {
  const mod = await import(
    "../../../apps/clickaton/scripts/lib/classify-smoke-database-url.ts"
  );
  return mod.classifySmokeDatabaseUrl as ClassifyFn;
}

function parsePg(raw: string): { host: string; database: string } {
  try {
    const normalized = raw
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    const database = decodeURIComponent(
      (u.pathname || "/").replace(/^\//, "").split("/")[0] ?? "",
    );
    return {
      host: (u.hostname || "").toLowerCase(),
      database: database.toLowerCase(),
    };
  } catch {
    return { host: "", database: "" };
  }
}

function maskHost(host: string): string {
  if (!host) return "absent";
  const parts = host.split(".");
  return `${host.slice(0, 10)}***${parts.length > 1 ? `.${parts.slice(-2).join(".")}` : ""}`;
}

async function main() {
  const stagingUrl = process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ?? "";
  const expectedEnv = (
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_ENV ?? "staging"
  )
    .trim()
    .toLowerCase();
  const expectedHostPrefix = (
    process.env.COMMUNICATIONS_EXPECTED_HOST_PREFIX ?? "ep-round-fog"
  )
    .trim()
    .toLowerCase();
  const expectedName = (
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_NAME ?? "neondb"
  )
    .trim()
    .toLowerCase();

  // Crítico: sin fallback a DATABASE_URL / DIRECT_URL / .env.
  if (process.env.DATABASE_URL && !stagingUrl) {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "COMMUNICATIONS_STAGING_DATABASE_URL_required_no_DATABASE_URL_fallback",
        warning: "DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS",
      }),
    );
    process.exit(1);
  }

  if (!stagingUrl) {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "COMMUNICATIONS_STAGING_DATABASE_URL_absent",
      }),
    );
    process.exit(1);
  }

  if (expectedEnv !== "staging") {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "expected_env_must_be_staging",
        expectedEnv,
      }),
    );
    process.exit(1);
  }

  const classify = await loadClassifier();
  const c = classify(stagingUrl);
  const { host, database } = parsePg(stagingUrl);

  const denylist =
    c.classification === "production" ||
    host.includes("ep-dawn-dew") ||
    /maratonfotografica\.com/i.test(stagingUrl);

  const hostOk = host.includes(expectedHostPrefix);
  const dbOk = !expectedName || database === expectedName;

  const report = {
    status: "UNKNOWN",
    classification: c.classification,
    classifyReason: c.reason,
    hostHint: maskHost(host),
    database,
    expectedEnv,
    expectedHostPrefix,
    expectedDatabaseName: expectedName,
    denylistHit: denylist,
    hostMatch: hostOk,
    databaseMatch: dbOk,
    connected: false as boolean,
    serverIdentity: null as null | { currentDatabase: string },
  };

  if (denylist || !hostOk || !dbOk || c.classification !== "staging") {
    console.log(
      JSON.stringify({
        ...report,
        status: "FAIL",
        reason: denylist
          ? "production_or_denylist"
          : !hostOk
            ? "host_mismatch"
            : !dbOk
              ? "database_name_mismatch"
              : `classification_${c.classification}`,
      }),
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ current_database: string }>>(
      "SELECT current_database() AS current_database",
    );
    const currentDatabase = (rows[0]?.current_database ?? "").toLowerCase();
    report.connected = true;
    report.serverIdentity = { currentDatabase };
    if (expectedName && currentDatabase !== expectedName) {
      console.log(
        JSON.stringify({
          ...report,
          status: "FAIL",
          reason: "server_database_mismatch",
        }),
      );
      process.exit(1);
    }
    console.log(
      JSON.stringify({
        ...report,
        status: "PASS",
        message: "STAGING DATABASE IDENTITY: RESOLVED",
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        ...report,
        status: "FAIL",
        reason: "connection_failed",
        error:
          error instanceof Error ? error.message.slice(0, 120) : "connect_error",
      }),
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "FAIL",
      reason: "unexpected",
      message: error instanceof Error ? error.message.slice(0, 160) : "error",
    }),
  );
  process.exit(1);
});
