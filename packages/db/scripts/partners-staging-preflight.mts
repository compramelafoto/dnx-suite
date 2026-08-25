/**
 * Preflight solo lectura — DNX Partners staging.
 *
 *   CLICKATON_STAGING_DATABASE_URL="…" \
 *   # o PARTNERS_STAGING_DATABASE_URL / COMMUNICATIONS_STAGING_DATABASE_URL
 *   pnpm --filter @repo/db partners:staging:preflight
 *
 * Sin URL staging explícita → FAIL (no usa DATABASE_URL / .env).
 * Host ep-dawn-dew / production → FAIL.
 */
import { PrismaClient } from "@prisma/client";
import {
  assertPartnersStagingIdentity,
  maskHost,
  PARTNERS_MIGRATION_DIRS,
  resolvePartnersStagingUrl,
} from "./partners-staging-identity.mts";

async function main() {
  console.log(
    JSON.stringify({
      scope: "dnx_partners_staging_preflight",
      warning: "NO_DATABASE_URL_FALLBACK",
      usesFallbackDatabaseUrl: false,
      expectedHostPrefix: "ep-round-fog",
      denylist: ["ep-dawn-dew", "maratonfotografica.com"],
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
        vercelNote:
          "vercel env pull/run no desencriptó DATABASE_URL sensitive; se requiere URL staging explícita",
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

  const prisma = new PrismaClient({
    datasources: { db: { url: stagingUrl } },
  });

  try {
    const editionCount = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM "ClickatonEdition"`,
    );
    const editions = Number(editionCount[0]?.c ?? 0);

    const partnerTables = await prisma.$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'DnxPartner%'
       ORDER BY table_name`,
    );

    const applied = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: Date | null }>
    >(
      `SELECT migration_name, finished_at FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])
       ORDER BY migration_name`,
      [...PARTNERS_MIGRATION_DIRS],
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));
    const pending = PARTNERS_MIGRATION_DIRS.filter((m) => !appliedSet.has(m));

    console.log(
      JSON.stringify({
        status: "PASS",
        hostHint: maskHost(identity.host),
        databaseName: identity.database,
        projectHint: "clickaton-staging",
        editionCount: editions,
        connectionRoleHint: "staging_url_explicit",
        dnxPartnerTableCount: partnerTables.length,
        partnerMigrationsApplied: [...appliedSet],
        partnerMigrationsPending: pending,
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
      message:
        error instanceof Error ? error.message.slice(0, 200) : "preflight_failed",
    }),
  );
  process.exit(1);
});
