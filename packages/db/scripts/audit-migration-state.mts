/**
 * Read-only audit: local prisma/migrations vs _prisma_migrations.
 *
 * Usage (explicit URL required — does NOT load packages/db/.env):
 *   DATABASE_URL='postgresql://…' pnpm exec tsx scripts/audit-migration-state.mts
 *   pnpm exec tsx scripts/audit-migration-state.mts --url 'postgresql://…'
 *
 * Safety: SELECT-only. Refuses if --allow-write is passed (there is no write mode).
 * Prefer a read-only DB role. Do not use this script to mutate Neon.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const ORPHAN = "20260711160000_infospot_role_audit";
const NEON_ORPHAN_CHECKSUM =
  "6f8e61ef3427db1cb927bbdc751f8ea500963aa2de35831799446c1d693be83f";

function parseArgs(argv: string[]) {
  const out: { url?: string; migrationsDir?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--migrations-dir") out.migrationsDir = argv[++i];
    else if (a === "--allow-write") {
      console.error("Refusing: this script is read-only (no --allow-write).");
      process.exit(2);
    }
  }
  return out;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listLocalMigrations(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() && existsSync(join(p, "migration.sql"));
    })
    .sort();
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

  const migrationsDir = resolve(
    args.migrationsDir ??
      join(process.cwd(), "prisma", "migrations"),
  );
  const local = listLocalMigrations(migrationsDir);
  const localSet = new Set(local);

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >`
      SELECT migration_name, checksum, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY migration_name ASC
    `;

    const dbNames = rows.map((r) => r.migration_name);
    const dbSet = new Set(dbNames);

    const onlyLocal = local.filter((n) => !dbSet.has(n));
    const onlyDb = dbNames.filter((n) => !localSet.has(n));
    const common = local.filter((n) => dbSet.has(n));

    const checksumMismatches: Array<{
      name: string;
      db: string;
      file: string;
    }> = [];
    for (const name of common) {
      const file = join(migrationsDir, name, "migration.sql");
      const fileSum = sha256File(file);
      const dbSum = rows.find((r) => r.migration_name === name)?.checksum ?? "";
      if (fileSum !== dbSum) {
        checksumMismatches.push({ name, db: dbSum, file: fileSum });
      }
    }

    const orphanLocal = localSet.has(ORPHAN);
    const orphanDb = rows.find((r) => r.migration_name === ORPHAN);

    const report = {
      migrationsDir,
      localCount: local.length,
      dbCount: rows.length,
      onlyLocal,
      onlyDb,
      checksumMismatches,
      orphan: {
        name: ORPHAN,
        presentLocally: orphanLocal,
        presentInDb: Boolean(orphanDb),
        dbChecksum: orphanDb?.checksum ?? null,
        matchesKnownNeonChecksum: orphanDb?.checksum === NEON_ORPHAN_CHECKSUM,
        localChecksum: orphanLocal
          ? sha256File(join(migrationsDir, ORPHAN, "migration.sql"))
          : null,
      },
      pendingLikely: onlyLocal,
      dirty:
        onlyDb.length > 0 ||
        checksumMismatches.length > 0 ||
        (Boolean(orphanDb) && !orphanLocal),
    };

    console.log(JSON.stringify(report, null, 2));
    process.exit(report.dirty ? 1 : 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
