/**
 * Migración protegida TIENDA store orders → solo staging (ep-round-fog).
 *
 * REQUIERE URL explícita (sin fallback a DATABASE_URL local):
 *
 *   CLICKATON_STAGING_DATABASE_URL="…" \
 *   # o COMMUNICATIONS_STAGING_DATABASE_URL (misma identidad Imp09)
 *   CLICKATON_EXPECTED_DATABASE_ENV=staging \
 *   CLICKATON_EXPECTED_HOST_PREFIX=ep-round-fog \
 *   CLICKATON_EXPECTED_DATABASE_NAME=neondb \
 *   pnpm --filter @repo/db store:migrate:staging -- --confirm-staging-migration
 *
 * Sin confirmación → SKIPPED.
 * Sin URL staging explícita → FAIL (no usa packages/db/.env).
 * Host ep-dawn-dew / production → FAIL.
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function parsePg(raw: string): { host: string; database: string } {
  try {
    const normalized = raw
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    const u = new URL(normalized);
    return {
      host: (u.hostname || "").toLowerCase(),
      database: decodeURIComponent(
        (u.pathname || "/").replace(/^\//, "").split("/")[0] ?? "",
      ).toLowerCase(),
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

function resolveStagingUrl(): string {
  return (
    process.env.CLICKATON_STAGING_DATABASE_URL?.trim() ||
    process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ||
    ""
  );
}

async function assertStagingIdentity(stagingUrl: string): Promise<{
  ok: boolean;
  reason: string;
  classification: string;
  host: string;
  database: string;
}> {
  const expectedEnv = (
    process.env.CLICKATON_EXPECTED_DATABASE_ENV ??
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_ENV ??
    "staging"
  )
    .trim()
    .toLowerCase();
  const expectedHostPrefix = (
    process.env.CLICKATON_EXPECTED_HOST_PREFIX ??
    process.env.COMMUNICATIONS_EXPECTED_HOST_PREFIX ??
    "ep-round-fog"
  )
    .trim()
    .toLowerCase();
  const expectedName = (
    process.env.CLICKATON_EXPECTED_DATABASE_NAME ??
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_NAME ??
    "neondb"
  )
    .trim()
    .toLowerCase();

  if (expectedEnv !== "staging") {
    return {
      ok: false,
      reason: "EXPECTED_DATABASE_ENV must be staging",
      classification: "blocked",
      host: "",
      database: "",
    };
  }

  const classify = await loadClassifier();
  const c = classify(stagingUrl);
  const { host, database } = parsePg(stagingUrl);

  if (
    c.classification === "production" ||
    host.includes("ep-dawn-dew") ||
    /maratonfotografica\.com/i.test(stagingUrl)
  ) {
    return {
      ok: false,
      reason: `production_database_blocked:${c.reason}`,
      classification: "production",
      host,
      database,
    };
  }
  if (c.classification !== "staging") {
    return {
      ok: false,
      reason: `expected_staging_got_${c.classification}:${c.reason}`,
      classification: c.classification,
      host,
      database,
    };
  }
  if (!host.includes(expectedHostPrefix)) {
    return {
      ok: false,
      reason: `host_prefix_mismatch_expected_${expectedHostPrefix}`,
      classification: c.classification,
      host,
      database,
    };
  }
  if (expectedName && database !== expectedName) {
    return {
      ok: false,
      reason: `database_name_mismatch_expected_${expectedName}`,
      classification: c.classification,
      host,
      database,
    };
  }

  return {
    ok: true,
    reason: c.reason,
    classification: c.classification,
    host,
    database,
  };
}

async function verifyStoreTables(prisma: PrismaClient): Promise<{
  orderReady: boolean;
  itemReady: boolean;
  holdReady: boolean;
}> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ table_name: string }>
  >(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'ClickatonStoreOrder',
         'ClickatonStoreOrderItem',
         'ClickatonStoreStockHold'
       )`,
  );
  const names = new Set(rows.map((r) => r.table_name));
  return {
    orderReady: names.has("ClickatonStoreOrder"),
    itemReady: names.has("ClickatonStoreOrderItem"),
    holdReady: names.has("ClickatonStoreStockHold"),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const confirm = hasFlag(argv, "--confirm-staging-migration");

  console.log(
    JSON.stringify({
      warning: "DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS",
      keyword: "TIENDA",
      step: "preflight",
      confirm,
      usesFallbackDatabaseUrl: false,
      migration: "20260802010000_clickaton_store_orders",
    }),
  );

  const stagingUrl = resolveStagingUrl();
  if (!stagingUrl) {
    console.log(
      JSON.stringify({
        status: "NOT_READY",
        reason: "STAGING_DATABASE_URL_absent",
        detail:
          "Set CLICKATON_STAGING_DATABASE_URL or COMMUNICATIONS_STAGING_DATABASE_URL (no fallback to DATABASE_URL)",
      }),
    );
    process.exit(1);
  }

  const identity = await assertStagingIdentity(stagingUrl);
  console.log(
    JSON.stringify({
      step: "identity",
      ok: identity.ok,
      classification: identity.classification,
      reason: identity.reason,
      hostHint: maskHost(identity.host),
      database: identity.database,
    }),
  );

  if (!identity.ok) {
    console.log(
      JSON.stringify({
        status: "NOT_READY",
        reason: "identity_guard_failed",
        detail: identity.reason,
      }),
    );
    process.exit(1);
  }

  if (!confirm) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "missing_--confirm-staging-migration",
        next: "Create Neon branch backup, then re-run with --confirm-staging-migration",
      }),
    );
    process.exit(0);
  }

  console.log(JSON.stringify({ step: "migrate_deploy", action: "start" }));
  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  execSync("pnpm exec prisma migrate deploy", {
    cwd: pkgRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: stagingUrl,
      DIRECT_URL:
        process.env.CLICKATON_STAGING_DIRECT_URL?.trim() ||
        process.env.COMMUNICATIONS_STAGING_DIRECT_URL?.trim() ||
        stagingUrl,
    },
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });
  try {
    const schema = await verifyStoreTables(prisma);
    const ok = schema.orderReady && schema.itemReady && schema.holdReady;
    console.log(
      JSON.stringify({
        status: ok ? "APPLIED" : "APPLIED_WITH_WARNINGS",
        ...schema,
      }),
    );
    if (!ok) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "FAILED",
      message:
        error instanceof Error ? error.message.slice(0, 200) : "migrate_failed",
    }),
  );
  process.exit(1);
});
