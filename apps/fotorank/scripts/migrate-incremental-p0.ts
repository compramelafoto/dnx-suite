/**
 * Migración incremental segura:
 * 1) DB vacía + migrate deploy SIN migraciones P0 (carpeta temporal)
 * 2) Inserta marcador User
 * 3) Restaura migraciones P0 y migrate deploy
 * 4) Verifica marcador + tablas P0
 *
 * DATABASE_URL='postgresql://USER@localhost:5432/fotorank_p0_08_incremental' \
 * DIRECT_URL="$DATABASE_URL" \
 *   pnpm --filter fotorank exec tsx scripts/migrate-incremental-p0.ts
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const migrationsDir = path.join(repoRoot, "packages/db/prisma/migrations");
const backupDir = path.join(repoRoot, "packages/db/prisma/.migrations_p0_backup_tmp");

const P0 = [
  "20260728120000_fotorank_p0_01_registration_rules_fee_assets",
  "20260728140000_fotorank_p0_06_entry_upload_exif_checklist",
  "20260728160000_fotorank_p0_07_jury_anonymization_rules_storage",
];

function runMigrateDeploy() {
  const r = spawnSync("pnpm", ["--filter", "@repo/db", "exec", "prisma", "migrate", "deploy"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error("prisma migrate deploy failed");
}

function stashP0() {
  mkdirSync(backupDir, { recursive: true });
  for (const d of P0) {
    const src = path.join(migrationsDir, d);
    const dest = path.join(backupDir, d);
    if (!existsSync(src)) throw new Error(`Missing migration ${d}`);
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    rmSync(src, { recursive: true, force: true });
  }
}

function restoreP0() {
  for (const d of P0) {
    const src = path.join(backupDir, d);
    const dest = path.join(migrationsDir, d);
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
  }
  rmSync(backupDir, { recursive: true, force: true });
}

async function main() {
  const check = assertSafeFotoRankDatabaseUrl();
  console.log("[incremental]", check);

  // Drop+create via psql for clean slate
  const db = check.database;
  spawnSync("dropdb", ["--if-exists", db], { stdio: "inherit" });
  spawnSync("createdb", [db], { stdio: "inherit" });

  let stashed = false;
  try {
    stashP0();
    stashed = true;
    console.log("[incremental] migrate deploy pre-P0…");
    runMigrateDeploy();

    const marker = await prisma.user.create({
      data: {
        email: `marker-pre-p0-${Date.now()}@fotorank.local`,
        name: "Marker Pre P0",
        password: "x",
      },
      select: { id: true, email: true },
    });
    console.log("[incremental] marcador", marker);

    restoreP0();
    stashed = false;
    console.log("[incremental] migrate deploy P0-01/06/07…");
    runMigrateDeploy();

    const still = await prisma.user.findUnique({ where: { id: marker.id } });
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN
       ('FotorankContestRegistration','FotorankContestEntryAsset','FotorankContestEntryCheck','FotorankJudgeEntryConflict')
       ORDER BY 1`,
    );

    if (!still) throw new Error("Marcador perdido");
    console.log(
      JSON.stringify(
        {
          ok: true,
          markerPreserved: still,
          p0Tables: tables.map((t) => t.table_name),
          database: db,
        },
        null,
        2,
      ),
    );
    await prisma.$disconnect();
  } finally {
    if (stashed) {
      console.error("[incremental] restaurando migraciones P0 tras error…");
      restoreP0();
    }
  }

  // sanity: P0 dirs back
  for (const d of P0) {
    if (!readdirSync(migrationsDir).includes(d)) {
      throw new Error(`Migración ${d} no restaurada en disco`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
