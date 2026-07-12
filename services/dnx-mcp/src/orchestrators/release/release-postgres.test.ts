import { describe, expect, it } from "vitest";
import type { ReleaseReadiness } from "../../providers/postgres/types/index.js";
import {
  assertPostgresAllowsReleaseExecution,
  describePostgresBlockers,
  postgresHasCriticalBlockers,
  PostgresReleaseBlockedError,
} from "./release-postgres.js";

const baseReadiness: ReleaseReadiness = {
  connected: true,
  version: "PostgreSQL 16.2",
  databaseSize: 1_048_576,
  activeConnections: 5,
  longRunningQueries: [],
  locks: [],
  migrationTableExists: true,
  riskLevel: "low",
  blockers: [],
  warnings: [],
  recommendation: "PostgreSQL listo para continuar con el pipeline de release",
};

describe("release-postgres", () => {
  it("postgres OK no tiene bloqueos críticos", () => {
    expect(postgresHasCriticalBlockers(baseReadiness)).toBe(false);
    expect(describePostgresBlockers(baseReadiness)).toEqual([]);
  });

  it("no conecta → bloqueo crítico", () => {
    const readiness = {
      ...baseReadiness,
      connected: false,
      riskLevel: "high" as const,
      blockers: ["No se pudo conectar a PostgreSQL"],
    };

    expect(postgresHasCriticalBlockers(readiness)).toBe(true);
    expect(describePostgresBlockers(readiness)).toContain("No se pudo conectar a PostgreSQL");
  });

  it("locks críticos → bloqueo", () => {
    const readiness = {
      ...baseReadiness,
      locks: [
        {
          pid: 42,
          lockType: "relation",
          mode: "AccessExclusiveLock",
          granted: false,
          relation: "users",
          query: "ALTER TABLE users ...",
        },
      ],
      riskLevel: "high" as const,
    };

    expect(postgresHasCriticalBlockers(readiness)).toBe(true);
    expect(describePostgresBlockers(readiness).some((b) => b.includes("lock"))).toBe(true);
  });

  it("long running queries → bloqueo", () => {
    const readiness = {
      ...baseReadiness,
      longRunningQueries: [
        {
          pid: 99,
          usename: "app",
          applicationName: "api",
          state: "active",
          query: "SELECT * FROM big_table",
          queryStart: "2026-01-01T00:00:00Z",
          waitEventType: null,
          durationMs: 120_000,
        },
      ],
      riskLevel: "high" as const,
    };

    expect(postgresHasCriticalBlockers(readiness)).toBe(true);
    expect(describePostgresBlockers(readiness).some((b) => b.includes("larga duración"))).toBe(
      true,
    );
  });

  it("migration table missing → bloqueo", () => {
    const readiness = {
      ...baseReadiness,
      migrationTableExists: false,
      riskLevel: "medium" as const,
      warnings: ["Tabla _prisma_migrations no encontrada"],
    };

    expect(postgresHasCriticalBlockers(readiness)).toBe(true);
    expect(describePostgresBlockers(readiness)).toContain("Tabla _prisma_migrations no encontrada");
  });

  it("assertPostgresAllowsReleaseExecution lanza con bloqueos", () => {
    expect(() => {
      assertPostgresAllowsReleaseExecution({
        ...baseReadiness,
        connected: false,
      });
    }).toThrow(PostgresReleaseBlockedError);
  });
});
