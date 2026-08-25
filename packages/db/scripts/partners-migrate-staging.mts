/**
 * Migración protegida DNX Partners → solo staging (ep-round-fog).
 *
 *   CLICKATON_STAGING_DATABASE_URL="…" \
 *   pnpm --filter @repo/db partners:migrate:staging -- \
 *     --confirm-staging-migration \
 *     --backup-ref=backup-partners-stage04-pre-migrate-YYYYMMDD
 *
 * Sin confirmación → SKIPPED.
 * Sin --backup-ref → FAIL.
 * Sin URL staging explícita → FAIL (no usa DATABASE_URL).
 * Host ep-dawn-dew / production → FAIL.
 * No usa prisma db push / migrate dev.
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  assertPartnersStagingIdentity,
  flagValue,
  hasFlag,
  maskHost,
  PARTNERS_MIGRATION_DIRS,
  resolvePartnersStagingUrl,
} from "./partners-staging-identity.mts";

async function verifyPartnerSchema(prisma: PrismaClient): Promise<{
  tables: string[];
  accessHasAccessKey: boolean;
  syncRunReady: boolean;
}> {
  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'DnxPartner%'
     ORDER BY table_name`,
  );
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'DnxPartnerBenefitAccess'
       AND column_name IN ('accessKey', 'source', 'sourceType')`,
  );
  const names = tables.map((t) => t.table_name);
  return {
    tables: names,
    accessHasAccessKey: cols.some((c) => c.column_name === "accessKey"),
    syncRunReady: names.includes("DnxPartnerBenefitSyncRun"),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const confirm = hasFlag(argv, "--confirm-staging-migration");
  const backupRef = flagValue(argv, "--backup-ref");

  console.log(
    JSON.stringify({
      scope: "dnx_partners_migrate_staging",
      warning: "DO_NOT_USE_LOCAL_DATABASE_URL",
      step: "preflight",
      confirm,
      backupRef: backupRef ? "present" : "absent",
      usesFallbackDatabaseUrl: false,
      migrations: PARTNERS_MIGRATION_DIRS,
    }),
  );

  const stagingUrl = resolvePartnersStagingUrl();
  if (!stagingUrl) {
    console.log(
      JSON.stringify({
        status: "NOT_READY",
        reason: "STAGING_DATABASE_URL_absent",
        detail:
          "Set CLICKATON_STAGING_DATABASE_URL | PARTNERS_STAGING_DATABASE_URL | COMMUNICATIONS_STAGING_DATABASE_URL",
      }),
    );
    process.exit(1);
  }

  const identity = await assertPartnersStagingIdentity(stagingUrl);
  console.log(
    JSON.stringify({
      step: "identity",
      ok: identity.ok,
      classification: identity.classification,
      reason: identity.reason,
      hostHint: maskHost(identity.host),
      databaseName: identity.database,
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
        next: "Create Neon branch/snapshot backup, then re-run with --confirm-staging-migration --backup-ref=<id>",
      }),
    );
    process.exit(0);
  }

  if (!backupRef || backupRef.length < 8) {
    console.log(
      JSON.stringify({
        status: "NOT_READY",
        reason: "missing_or_short_--backup-ref",
        detail:
          "Pass --backup-ref=<neon-branch-or-snapshot-id> after verifying backup exists",
      }),
    );
    process.exit(1);
  }

  const prismaPre = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });
  let pending: string[] = [];
  try {
    const applied = await prismaPre.$queryRawUnsafe<
      Array<{ migration_name: string }>
    >(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])`,
      [...PARTNERS_MIGRATION_DIRS],
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));
    pending = PARTNERS_MIGRATION_DIRS.filter((m) => !appliedSet.has(m));
    console.log(
      JSON.stringify({
        step: "pending",
        pending,
        backupRefSanitized: backupRef.slice(0, 48),
      }),
    );
  } finally {
    await prismaPre.$disconnect();
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
        process.env.PARTNERS_STAGING_DIRECT_URL?.trim() ||
        process.env.COMMUNICATIONS_STAGING_DIRECT_URL?.trim() ||
        stagingUrl,
    },
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });
  try {
    const schema = await verifyPartnerSchema(prisma);
    const appliedAfter = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string }>
    >(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])
       ORDER BY migration_name`,
      [...PARTNERS_MIGRATION_DIRS],
    );
    const ok =
      schema.accessHasAccessKey &&
      schema.syncRunReady &&
      appliedAfter.length === PARTNERS_MIGRATION_DIRS.length;
    console.log(
      JSON.stringify({
        status: ok ? "APPLIED" : "APPLIED_WITH_WARNINGS",
        hostHint: maskHost(identity.host),
        databaseName: identity.database,
        backupRefSanitized: backupRef.slice(0, 48),
        partnerTables: schema.tables.length,
        accessHasAccessKey: schema.accessHasAccessKey,
        syncRunReady: schema.syncRunReady,
        partnerMigrationsApplied: appliedAfter.map((r) => r.migration_name),
        previouslyPending: pending,
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
