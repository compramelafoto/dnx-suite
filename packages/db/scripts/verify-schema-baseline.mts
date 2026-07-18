/**
 * Read-only schema baseline checks for InfoSpot role audit / Clickaton gate.
 *
 * Usage:
 *   DATABASE_URL='postgresql://…' pnpm exec tsx scripts/verify-schema-baseline.mts
 *   pnpm exec tsx scripts/verify-schema-baseline.mts --url 'postgresql://…'
 *
 * Does NOT load packages/db/.env. SELECT-only.
 */
import { PrismaClient } from "@prisma/client";

const ORPHAN = "20260711160000_infospot_role_audit";
const NEON_ORPHAN_CHECKSUM =
  "59bc655d2789c5c5ee0cc3988caf2a61bb0d91cb0a2361c06eab4ef1c714ddb9"; // post-10C4B reconstructed

function parseArgs(argv: string[]) {
  const out: { url?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") out.url = argv[++i];
    if (argv[i] === "--allow-write") {
      console.error("Refusing: read-only script.");
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? process.env.DATABASE_URL ?? process.env.AUDIT_DATABASE_URL;
  if (!url) {
    console.error(
      "Missing URL. Set DATABASE_URL / AUDIT_DATABASE_URL or pass --url. Does not load .env.",
    );
    process.exit(2);
  }
  if (/neon\.tech/i.test(url)) {
    console.warn(
      "WARN: URL looks like Neon. Continuing READ-ONLY (SELECT). Do not use write credentials.",
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const cols = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string }>
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'InfoSpotUserRole'
        AND column_name IN (
          'lastChangedAt',
          'assignedByUserId',
          'lastChangedByUserId'
        )
      ORDER BY column_name
    `;

    const orphan = await prisma.$queryRaw<
      Array<{ migration_name: string; checksum: string; finished_at: Date | null }>
    >`
      SELECT migration_name, checksum, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${ORPHAN}
      LIMIT 1
    `;

    const clickaton = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name IN (
        '20260718120000_clickaton_editions_and_venues',
        '20260718140000_fotoffice_photographer_onboarding'
      )
      ORDER BY migration_name
    `;

    const colNames = new Set(cols.map((c) => c.column_name));
    const checks = {
      infoSpotUserRole: {
        hasLastChangedAt: colNames.has("lastChangedAt"),
        hasAssignedByUserId: colNames.has("assignedByUserId"),
        hasLastChangedByUserId: colNames.has("lastChangedByUserId"),
        columns: cols,
      },
      orphanMigration: {
        present: orphan.length > 0,
        checksum: orphan[0]?.checksum ?? null,
        matchesKnownNeonChecksum:
          orphan[0]?.checksum === NEON_ORPHAN_CHECKSUM,
        finished_at: orphan[0]?.finished_at ?? null,
      },
      clickatonMigrationsApplied: clickaton,
    };

    const ok =
      checks.infoSpotUserRole.hasLastChangedAt &&
      checks.infoSpotUserRole.hasAssignedByUserId &&
      checks.infoSpotUserRole.hasLastChangedByUserId;

    console.log(JSON.stringify({ ok, checks }, null, 2));
    process.exit(ok ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
