import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PrismaExecutor } from "./client/prisma-executor.js";
import { PrismaProvider } from "./provider.js";

const SAMPLE_SCHEMA = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Post {
  id Int @id @default(autoincrement())
}
`;

function createFixture(): {
  root: string;
  schemaPath: string;
  migrationsPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "dnx-prisma-provider-"));
  const schemaPath = join(root, "prisma", "schema.prisma");
  mkdirSync(dirname(schemaPath), { recursive: true });
  writeFileSync(schemaPath, SAMPLE_SCHEMA);

  const migrationsPath = join(root, "prisma", "migrations");
  const migrationFolder = join(migrationsPath, "20240101000000_init");
  mkdirSync(migrationFolder, { recursive: true });
  writeFileSync(join(migrationFolder, "migration.sql"), 'CREATE TABLE "Post" ();');
  writeFileSync(join(migrationsPath, "migration_lock.toml"), 'provider = "postgresql"\n');

  return { root, schemaPath, migrationsPath };
}

function createMockExecutor(
  responses: Partial<{
    validateExit: number;
    formatExit: number;
    migrateStatus: string;
  }> = {},
): PrismaExecutor {
  const validateExit = responses.validateExit ?? 0;
  const formatExit = responses.formatExit ?? 0;
  const migrateStatus = responses.migrateStatus ?? "Database schema is up to date!";

  const run = vi.fn((args: readonly string[]) => {
    const cmd = args.join(" ");
    if (cmd.startsWith("validate")) {
      return Promise.resolve({
        stdout: validateExit === 0 ? "The schema is valid" : "",
        stderr: validateExit === 0 ? "" : "Schema validation error",
        exitCode: validateExit,
      });
    }
    if (cmd.startsWith("format")) {
      return Promise.resolve({
        stdout: "",
        stderr: formatExit === 0 ? "" : "Formatting would change schema",
        exitCode: formatExit,
      });
    }
    if (cmd.startsWith("migrate status")) {
      return Promise.resolve({
        stdout: migrateStatus,
        stderr: "",
        exitCode: 0,
      });
    }
    return Promise.reject(new Error(`Unexpected prisma command: ${cmd}`));
  });

  return {
    run,
    runText: vi.fn(async (args: readonly string[]) => {
      const result = await run(args);
      return `${result.stdout}${result.stderr}`.trimEnd();
    }),
    runExpectSuccess: vi.fn(),
  } as unknown as PrismaExecutor;
}

describe("PrismaProvider", () => {
  it("reporta configurado cuando el schema existe", () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor(),
    });
    expect(provider.isConfigured()).toBe(true);
  });

  it("expone stats del schema", () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor(),
    });

    const stats = provider.getSchemaStats();
    expect(stats.models).toEqual(["Post"]);
    expect(stats.generators).toEqual(["client"]);
  });

  it("lista migraciones locales", () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor(),
    });

    expect(provider.getMigrationCount()).toBe(1);
    expect(provider.getLatestMigration()).toBe("20240101000000_init");
  });

  it("assessReleaseReadiness reporta estado listo", async () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor(),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.schemaValid).toBe(true);
    expect(readiness.migrationCount).toBe(1);
    expect(readiness.latestMigration).toBe("20240101000000_init");
    expect(readiness.pendingMigrations).toEqual([]);
    expect(readiness.riskLevel).toBe("low");
    expect(readiness.blockers).toEqual([]);
    expect(readiness.recommendation).toContain("listo");
  });

  it("assessReleaseReadiness bloquea con migraciones pendientes", async () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor({
        migrateStatus: `Following migrations have not yet been applied:\n20240101000000_init`,
      }),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.riskLevel).toBe("high");
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.pendingMigrations).toEqual(["20240101000000_init"]);
    expect(readiness.recommendation).toContain("No liberar");
  });

  it("assessReleaseReadiness advierte con format drift", async () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor({ formatExit: 1 }),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.riskLevel).toBe("medium");
    expect(readiness.warnings.some((w) => w.includes("format"))).toBe(true);
  });

  it("hasPendingMigrations detecta pendientes", async () => {
    const { root, schemaPath, migrationsPath } = createFixture();
    const provider = new PrismaProvider({
      config: { schemaPath, migrationsPath, cwd: root },
      executor: createMockExecutor({
        migrateStatus: `Following migrations have not yet been applied:\n20240101000000_init`,
      }),
    });

    expect(await provider.hasPendingMigrations()).toBe(true);
  });
});
