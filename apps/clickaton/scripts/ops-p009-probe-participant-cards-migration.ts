/**
 * Probe ClickatonParticipantCard migration on an explicit DATABASE_URL.
 * Refuses denylist hosts (ep-dawn-dew) and requires ep-round-fog staging.
 *
 *   DATABASE_URL=… pnpm --filter clickaton exec tsx scripts/ops-p009-probe-participant-cards-migration.ts
 */
import { prisma } from "@repo/db";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL required");
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`Refusing host ${host}`);
  }
  const table = await prisma.$queryRawUnsafe<Array<{ t: string | null }>>(
    `SELECT to_regclass('public."ClickatonParticipantCard"')::text AS t`
  );
  const migrations = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string; finished: boolean }>
  >(
    `SELECT migration_name, finished_at IS NOT NULL AS finished
     FROM _prisma_migrations
     WHERE migration_name LIKE '%20260801140000%'
        OR migration_name LIKE '%participant_card%'`
  );
  const enumRows = await prisma.$queryRawUnsafe<Array<{ label: string }>>(
    `SELECT e.enumlabel::text AS label
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = 'DnxMediaAssetKind'
       AND e.enumlabel = 'PARTICIPANT_CARD_PNG'`
  );
  const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'ClickatonParticipantCard'
     ORDER BY indexname`
  );
  const fks = await prisma.$queryRawUnsafe<Array<{ conname: string }>>(
    `SELECT c.conname::text AS conname
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     WHERE t.relname = 'ClickatonParticipantCard' AND c.contype = 'f'
     ORDER BY c.conname`
  );
  console.log(
    JSON.stringify(
      {
        host: host.replace(/(ep-round-fog)(-[a-z0-9]+).*/, "$1…"),
        table: table[0]?.t ?? null,
        migrations,
        participantCardPng: enumRows.length > 0,
        indexes: indexes.map((r) => r.indexname),
        foreignKeys: fks.map((r) => r.conname),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
