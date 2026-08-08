/**
 * Migración protegida DNX Partners → producción Clickatón (ep-silent-haze).
 *
 *   CLICKATON_PRODUCTION_DATABASE_URL="…" \
 *   pnpm --filter @repo/db partners:migrate:production -- \
 *     --confirm-production-migration \
 *     --backup-ref=br-damp-rain-awj86hh9 \
 *     --expected-host=ep-silent-haze
 *
 * Rechaza ep-round-fog (staging) y cualquier host no allowlisted.
 * No usa DATABASE_URL genérica. No usa db push / migrate dev.
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ALLOWED_HOST_PREFIX = "ep-silent-haze";
const DENY_HOSTS = ["ep-round-fog", "ep-dawn-dew"];
const PARTNERS_MIGRATIONS = [
  "20260802120000_dnx_partners_domain",
  "20260802150000_dnx_partner_benefit_access",
  "20260802160000_dnx_partner_assets",
  "20260803120000_dnx_partner_benefit_eligibility",
  "20260803180000_dnx_partner_benefit_auto_sync_caps",
  "20260807120000_dnx_partner_institutional_roles",
  "20260807140000_dnx_partner_click_tracking",
  "20260807180000_dnx_partner_public_visibility",
  "20260807190000_dnx_partner_onboarding_invitation",
  "20260807210000_dnx_partner_logo_general",
];

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flagValue(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx < 0) return null;
  const arg = process.argv[idx]!;
  if (arg.includes("=")) return arg.split("=").slice(1).join("=") || null;
  return process.argv[idx + 1] ?? null;
}

function maskHost(host: string): string {
  if (host.length <= 18) return `${host.slice(0, 8)}…`;
  return `${host.slice(0, 14)}…`;
}

function resolveProductionUrl(): string | null {
  return (
    process.env.CLICKATON_PRODUCTION_DATABASE_URL?.trim() ||
    process.env.PARTNERS_PRODUCTION_DATABASE_URL?.trim() ||
    null
  );
}

async function main() {
  const confirm = hasFlag("--confirm-production-migration");
  const backupRef = flagValue("--backup-ref");
  const expectedHost = flagValue("--expected-host") ?? ALLOWED_HOST_PREFIX;

  console.log(
    JSON.stringify({
      scope: "dnx_partners_migrate_production",
      warning: "PRODUCTION — no staging, no DATABASE_URL fallback",
      confirm,
      backupRef: backupRef ? "PRESENT" : "absent",
      expectedHost,
      denylist: DENY_HOSTS,
    }),
  );

  if (!confirm) {
    console.log(
      JSON.stringify({
        status: "SKIPPED",
        reason: "missing_--confirm-production-migration",
      }),
    );
    process.exit(2);
  }
  if (!backupRef) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "missing_--backup-ref",
      }),
    );
    process.exit(1);
  }

  const url = resolveProductionUrl();
  if (!url) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "PRODUCTION_DATABASE_URL_absent",
        detail: "Set CLICKATON_PRODUCTION_DATABASE_URL",
      }),
    );
    process.exit(1);
  }

  const host = new URL(url).hostname;
  const database = new URL(url).pathname.replace(/^\//, "").split("?")[0] || "";
  if (DENY_HOSTS.some((d) => host.includes(d))) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "denylist_host",
        hostHint: maskHost(host),
      }),
    );
    process.exit(1);
  }
  if (!host.includes(expectedHost) || !host.includes(ALLOWED_HOST_PREFIX)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "host_not_production_allowlist",
        hostHint: maskHost(host),
        expected: ALLOWED_HOST_PREFIX,
      }),
    );
    process.exit(1);
  }
  const allowedDatabases = new Set(["neondb", "clickaton_production"]);
  if (!allowedDatabases.has(database)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "unexpected_database",
        databaseName: database,
      }),
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const editions = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM "ClickatonEdition"`,
    );
    console.log(
      JSON.stringify({
        step: "preflight",
        status: "READY",
        hostHint: maskHost(host),
        databaseName: database,
        projectHint: "clickaton-production",
        editionCount: Number(editions[0]?.c ?? 0),
        backupRef,
      }),
    );

    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const env = {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: process.env.CLICKATON_PRODUCTION_DIRECT_URL || url,
    };

    const run = (cmd: string, allowNonZero = false) => {
      try {
        execSync(cmd, { cwd: root, env, stdio: "inherit" });
      } catch (err) {
        if (!allowNonZero) throw err;
      }
    };

    console.log(JSON.stringify({ step: "migrate_status_before" }));
    // prisma migrate status exits 1 when pending — expected.
    run("pnpm exec prisma migrate status", true);

    const pending = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM "_prisma_migrations"`,
    );
    const appliedSet = new Set(pending.map((r) => r.migration_name));
    // Detect foreign pending by filesystem later; log partners pending only.
    const partnersPending = PARTNERS_MIGRATIONS.filter((m) => !appliedSet.has(m));
    console.log(
      JSON.stringify({
        step: "partners_pending",
        partnersPending,
        note: "prisma migrate deploy aplicará TODAS las pendientes del directorio",
      }),
    );

    console.log(JSON.stringify({ step: "migrate_deploy" }));
    run("pnpm exec prisma migrate deploy");

    console.log(JSON.stringify({ step: "migrate_status_after" }));
    run("pnpm exec prisma migrate status", true);
    run("pnpm exec prisma validate");
    run("pnpm exec prisma generate");

    const applied = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])
       ORDER BY migration_name`,
      [...PARTNERS_MIGRATIONS],
    );
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'DnxPartner%'
       ORDER BY table_name`,
    );
    console.log(
      JSON.stringify({
        status: "APPLIED",
        hostHint: maskHost(host),
        partnerMigrationsApplied: applied.map((r) => r.migration_name),
        dnxPartnerTableCount: tables.length,
        backupRef,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "FAILED",
      message: error instanceof Error ? error.message.slice(0, 240) : "migrate_failed",
    }),
  );
  process.exit(1);
});
