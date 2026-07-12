import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getMigrationStatusLocal,
  getSchemaHash,
  parseMigrateStatusOutput,
  parseSchemaStats,
} from "./index.js";

const SAMPLE_SCHEMA = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

model User {
  id   Int  @id @default(autoincrement())
  role Role @default(USER)
}
`;

function createFixture(): {
  root: string;
  schemaPath: string;
  migrationsPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "dnx-prisma-"));
  const schemaPath = join(root, "prisma", "schema.prisma");
  mkdirSync(dirname(schemaPath), { recursive: true });
  writeFileSync(schemaPath, SAMPLE_SCHEMA);

  const migrationsPath = join(root, "prisma", "migrations");
  const migrationFolder = join(migrationsPath, "20240101000000_init");
  mkdirSync(migrationFolder, { recursive: true });
  writeFileSync(join(migrationFolder, "migration.sql"), 'CREATE TABLE "User" ();');
  writeFileSync(join(migrationsPath, "migration_lock.toml"), 'provider = "postgresql"\n');

  return { root, schemaPath, migrationsPath };
}

describe("schema-parser", () => {
  it("parsea modelos, enums, datasources y generators", () => {
    const { schemaPath } = createFixture();
    const stats = parseSchemaStats(schemaPath);

    expect(stats.models).toEqual(["User"]);
    expect(stats.enums).toEqual(["Role"]);
    expect(stats.datasources).toEqual(["db"]);
    expect(stats.generators).toEqual(["client"]);
  });

  it("genera hash estable del schema", () => {
    const { schemaPath } = createFixture();
    const hash1 = getSchemaHash(schemaPath);
    const hash2 = getSchemaHash(schemaPath);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });
});

describe("migration-parser", () => {
  it("lista migraciones locales ordenadas", () => {
    const { migrationsPath } = createFixture();
    const status = getMigrationStatusLocal(migrationsPath);

    expect(status.migrationCount).toBe(1);
    expect(status.latestMigration).toBe("20240101000000_init");
    expect(status.lockProvider).toBe("postgresql");
  });

  it("detecta migraciones pendientes en migrate status", () => {
    const output = `
Following migrations have not yet been applied:
20240101000000_init
20240201000000_add_posts

To apply migrations in development run prisma migrate dev.
`;
    const status = parseMigrateStatusOutput(output);
    expect(status.upToDate).toBe(false);
    expect(status.pendingMigrations).toEqual(["20240101000000_init", "20240201000000_add_posts"]);
  });

  it("detecta schema al día", () => {
    const output = "Database schema is up to date!";
    const status = parseMigrateStatusOutput(output);
    expect(status.upToDate).toBe(true);
    expect(status.pendingMigrations).toEqual([]);
    expect(status.databaseReachable).toBe(true);
  });
});
