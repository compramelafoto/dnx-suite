/**
 * Migración protegida DNX Partners → producción FotoRank (ep-dawn-dew / neondb).
 *
 * Neon: proyecto compramelafoto (divine-hall…), branch `development` (= DB usada por
 * fotorank-dnxsuite Production). No confundir con Clickatón (ep-silent-haze) ni staging (ep-round-fog).
 *
 *   FOTORANK_PRODUCTION_DATABASE_URL="…" \
 *   pnpm --filter @repo/db partners:migrate:fotorank-production -- \
 *     --confirm-fotorank-production-migration \
 *     --backup-ref=br-fragrant-base-ad24cuvm
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ALLOWED_HOST = "ep-dawn-dew";
const DENY_HOSTS = ["ep-round-fog", "ep-silent-haze"];
const ALLOWED_DATABASES = new Set(["neondb"]);
const PARTNERS_MIGRATIONS = [
  "20260802120000_dnx_partners_domain",
  "20260802150000_dnx_partner_benefit_access",
  "20260802160000_dnx_partner_assets",
  "20260803120000_dnx_partner_benefit_eligibility",
  "20260803180000_dnx_partner_benefit_auto_sync_caps",
  "20260807120000_dnx_partner_institutional_roles",
];

function hasFlag(name: string): boolean {
  return process.argv.some((a) => a === name || a.startsWith(`${name}=`));
}

function flagValue(name: string): string | null {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1) || null;
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function maskHost(host: string): string {
  return host.length <= 18 ? `${host.slice(0, 8)}…` : `${host.slice(0, 14)}…`;
}

function resolveUrl(): string | null {
  return (
    process.env.FOTORANK_PRODUCTION_DATABASE_URL?.trim() ||
    process.env.PARTNERS_FOTORANK_PRODUCTION_DATABASE_URL?.trim() ||
    null
  );
}

async function main() {
  const confirm = hasFlag("--confirm-fotorank-production-migration");
  const backupRef = flagValue("--backup-ref");

  console.log(
    JSON.stringify({
      scope: "dnx_partners_migrate_fotorank_production",
      warning: "FOTORANK PRODUCTION — reject staging/clickaton hosts",
      confirm,
      backupRef: backupRef ? "PRESENT" : "absent",
      allowedHost: ALLOWED_HOST,
      denylist: DENY_HOSTS,
    }),
  );

  if (!confirm) {
    console.log(JSON.stringify({ status: "SKIPPED", reason: "missing_confirm_flag" }));
    process.exit(2);
  }
  if (!backupRef) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "missing_--backup-ref" }));
    process.exit(1);
  }

  const url = resolveUrl();
  if (!url) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "FOTORANK_PRODUCTION_DATABASE_URL_absent",
      }),
    );
    process.exit(1);
  }

  const host = new URL(url).hostname;
  const database = new URL(url).pathname.replace(/^\//, "").split("?")[0] || "";
  if (DENY_HOSTS.some((d) => host.includes(d))) {
    console.log(
      JSON.stringify({ status: "BLOCKED", reason: "denylist_host", hostHint: maskHost(host) }),
    );
    process.exit(1);
  }
  if (!host.includes(ALLOWED_HOST)) {
    console.log(
      JSON.stringify({
        status: "BLOCKED",
        reason: "host_not_fotorank_production",
        hostHint: maskHost(host),
        expected: ALLOWED_HOST,
      }),
    );
    process.exit(1);
  }
  if (!ALLOWED_DATABASES.has(database)) {
    console.log(
      JSON.stringify({ status: "BLOCKED", reason: "unexpected_database", databaseName: database }),
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: process.env.FOTORANK_PRODUCTION_DIRECT_URL || url,
  };
  const run = (cmd: string, allowNonZero = false) => {
    try {
      execSync(cmd, { cwd: root, env, stdio: "inherit" });
    } catch (err) {
      if (!allowNonZero) throw err;
    }
  };

  try {
    const contests = await prisma.fotorankContest.count();
    const sf = await prisma.fotorankContest.count({
      where: { slug: { contains: "santa-fe", mode: "insensitive" } },
    });
    console.log(
      JSON.stringify({
        step: "preflight",
        status: "READY",
        hostHint: maskHost(host),
        databaseName: database,
        projectHint: "compramelafoto/neon · fotorank-dnxsuite",
        neonBranchHint: "development",
        contestCount: contests,
        santaFeCount: sf,
        backupRef,
      }),
    );

    console.log(JSON.stringify({ step: "migrate_status_before" }));
    run("pnpm exec prisma migrate status", true);

    const appliedRows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name FROM "_prisma_migrations"`,
    );
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));
    console.log(
      JSON.stringify({
        step: "partners_pending",
        partnersPending: PARTNERS_MIGRATIONS.filter((m) => !appliedSet.has(m)),
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
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='DnxPartnerParticipation'
         AND column_name IN ('institutionalRole','displayTier','displayOrder','publicRoleLabel')
       ORDER BY 1`,
    );
    console.log(
      JSON.stringify({
        status: "APPLIED",
        hostHint: maskHost(host),
        partnerMigrationsApplied: applied.map((r) => r.migration_name),
        institutionalColumns: cols.map((c) => c.column_name),
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
