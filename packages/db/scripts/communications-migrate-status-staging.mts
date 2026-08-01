/**
 * migrate status / table checks — solo con COMMUNICATIONS_STAGING_DATABASE_URL.
 *
 *   COMMUNICATIONS_STAGING_DATABASE_URL="…" \
 *   pnpm --filter @repo/db communications:migrate:status:staging
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

type ClassifyFn = (raw: string | undefined) => {
  classification: string;
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

async function main() {
  console.log(
    JSON.stringify({
      warning: "DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS",
    }),
  );

  const stagingUrl = process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ?? "";
  if (!stagingUrl) {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "COMMUNICATIONS_STAGING_DATABASE_URL_absent",
      }),
    );
    process.exit(1);
  }

  const classify = await loadClassifier();
  const c = classify(stagingUrl);
  const { host, database } = parsePg(stagingUrl);
  const expectedHost = (
    process.env.COMMUNICATIONS_EXPECTED_HOST_PREFIX ??
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_HOST ??
    "ep-round-fog"
  )
    .trim()
    .toLowerCase();
  const expectedName = (
    process.env.COMMUNICATIONS_EXPECTED_DATABASE_NAME ?? "neondb"
  )
    .trim()
    .toLowerCase();

  if (
    c.classification !== "staging" ||
    host.includes("ep-dawn-dew") ||
    !host.includes(expectedHost) ||
    (expectedName && database !== expectedName)
  ) {
    console.log(
      JSON.stringify({
        status: "FAIL",
        reason: "identity_guard_failed",
        classification: c.classification,
        hostHint: maskHost(host),
        database,
      }),
    );
    process.exit(1);
  }

  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  let migrateStatus = "";
  try {
    migrateStatus = execSync("pnpm exec prisma migrate status", {
      cwd: pkgRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: stagingUrl,
        DIRECT_URL:
          process.env.COMMUNICATIONS_STAGING_DIRECT_URL?.trim() || stagingUrl,
      },
    });
  } catch (error) {
    migrateStatus =
      error instanceof Error && "stdout" in error
        ? String((error as { stdout?: string }).stdout ?? error.message)
        : "migrate_status_failed";
  }

  const target = "20260801120000_dnx_communication_webhook_events";
  const pending = /not yet been applied|Following migration|have not yet/i.test(
    migrateStatus,
  );
  const applied = new RegExp(target, "i").test(migrateStatus) && !pending
    ? /Database schema is up to date/i.test(migrateStatus)
    : /Database schema is up to date/i.test(migrateStatus);

  const prisma = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });
  try {
    const tables = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'DnxCommunicationWebhookEvent'
      ) AS exists`,
    );
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'DnxCommunicationWebhookEvent'`,
    );
    const tableExists = Boolean(tables[0]?.exists);
    const uniqueExists = indexes.some((i) =>
      i.indexname.includes("provider_providerEventId"),
    );

    let migrationTarget: "PENDING" | "ALREADY_APPLIED" | "UNKNOWN" = "UNKNOWN";
    if (tableExists && uniqueExists) migrationTarget = "ALREADY_APPLIED";
    else if (!tableExists) migrationTarget = "PENDING";

    console.log(
      JSON.stringify({
        status: "PASS",
        hostHint: maskHost(host),
        database,
        tableExists,
        uniqueExists,
        migrationTarget: `${target}: ${migrationTarget}`,
        migrateStatusExcerpt: migrateStatus
          .split("\n")
          .filter((l) =>
            /migration|Database|pending|applied|up to date|not yet/i.test(l),
          )
          .slice(0, 20),
        schemaUpToDate: /Database schema is up to date/i.test(migrateStatus),
        appliedHint: applied,
      }),
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "FAIL",
      message: error instanceof Error ? error.message.slice(0, 160) : "error",
    }),
  );
  process.exit(1);
});
