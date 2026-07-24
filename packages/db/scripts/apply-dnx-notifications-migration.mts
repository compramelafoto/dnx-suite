/**
 * Aplica SOLO el DDL del Notifications Engine (aditivo).
 *
 * Requiere: DNX_NOTIFICATIONS_ALLOW_MIGRATE=1
 *
 *   DNX_NOTIFICATIONS_ALLOW_MIGRATE=1 pnpm --filter @repo/db exec tsx scripts/apply-dnx-notifications-migration.mts
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const MIGRATION_NAME = "20260723180000_dnx_notifications_engine_etapa18";

function anonymizeUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");
}

async function main() {
  if (process.env.DNX_NOTIFICATIONS_ALLOW_MIGRATE !== "1") {
    throw new Error("Set DNX_NOTIFICATIONS_ALLOW_MIGRATE=1 para continuar.");
  }
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL / DIRECT_URL no configurada.");
  if (/prod-primary|production-primary/i.test(databaseUrl)) {
    throw new Error("Host parece producción primaria. Abortado.");
  }
  console.log("[notifications-migrate] host:", anonymizeUrl(databaseUrl));

  const dir = dirname(fileURLToPath(import.meta.url));
  const sqlPath = resolve(
    dir,
    "../prisma/migrations/20260723180000_dnx_notifications_engine_etapa18/migration.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  const schemaPath = resolve(dir, "../prisma/schema.prisma");
  const result = spawnSync(
    "pnpm",
    ["exec", "prisma", "db", "execute", "--schema", schemaPath, "--file", sqlPath],
    { cwd: resolve(dir, ".."), stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    throw new Error(`prisma db execute failed with status ${result.status}`);
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION_NAME}' LIMIT 1`,
    );
    if (rows.length === 0) {
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ('${id}', '${checksum}', NOW(), '${MIGRATION_NAME}', NULL, NULL, NOW(), 1)`,
      );
      console.log("[notifications-migrate] recorded in _prisma_migrations");
    } else {
      console.log("[notifications-migrate] already recorded");
    }

    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'DnxNotification%'
       ORDER BY 1`,
    );
    console.log(
      "[notifications-migrate] tables:",
      tables.map((t) => t.table_name).join(", "),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
