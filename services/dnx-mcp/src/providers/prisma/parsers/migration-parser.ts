import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MigrateStatus, MigrationInfo, MigrationStatusLocal } from "../types/index.js";
import { migrateStatusSchema, migrationStatusLocalSchema } from "../types/index.js";

export function listMigrationFolders(migrationsPath: string): MigrationInfo[] {
  if (!existsSync(migrationsPath)) {
    return [];
  }

  const entries = readdirSync(migrationsPath, { withFileTypes: true });
  const migrations: MigrationInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const folder = join(migrationsPath, entry.name);
    const sqlPath = join(folder, "migration.sql");
    if (!existsSync(sqlPath)) {
      continue;
    }

    migrations.push({
      name: entry.name,
      folder,
    });
  }

  return migrations.sort((a, b) => a.name.localeCompare(b.name));
}

export function getMigrationStatusLocal(migrationsPath: string): MigrationStatusLocal {
  const migrations = listMigrationFolders(migrationsPath);
  const latest = migrations.at(-1)?.name ?? null;
  const lockProvider = readMigrationLockProvider(migrationsPath);

  return migrationStatusLocalSchema.parse({
    migrationCount: migrations.length,
    latestMigration: latest,
    migrations,
    lockProvider,
  });
}

export function parseMigrateStatusOutput(output: string): MigrateStatus {
  const normalized = output.toLowerCase();
  const pendingMigrations = extractPendingMigrations(output);

  const upToDate =
    normalized.includes("database schema is up to date") ||
    (pendingMigrations.length === 0 && normalized.includes("no pending migrations"));

  const databaseReachable =
    !normalized.includes("p1001") &&
    !normalized.includes("can't reach database server") &&
    !normalized.includes("environment variable not found");

  return migrateStatusSchema.parse({
    upToDate,
    pendingMigrations,
    databaseReachable,
    rawOutput: output,
  });
}

function extractPendingMigrations(output: string): string[] {
  const lines = output.split("\n");
  const pending: string[] = [];
  let capture = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/following migrations have not yet been applied/i.test(trimmed)) {
      capture = true;
      continue;
    }

    if (capture) {
      if (!trimmed || trimmed.startsWith("To apply migrations")) {
        break;
      }
      const match = /^(\d{14}_[\w-]+)/.exec(trimmed);
      if (match?.[1]) {
        pending.push(match[1]);
      }
    }
  }

  return pending;
}

function readMigrationLockProvider(migrationsPath: string): string | null {
  const lockPath = join(migrationsPath, "migration_lock.toml");
  if (!existsSync(lockPath)) {
    return null;
  }

  const content = readFileSync(lockPath, "utf8");
  const match = /provider\s*=\s*"([^"]+)"/.exec(content);
  return match?.[1] ?? null;
}
