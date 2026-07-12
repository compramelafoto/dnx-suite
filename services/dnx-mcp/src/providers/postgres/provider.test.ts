import { describe, expect, it, vi } from "vitest";
import type { PostgresClientAdapter } from "./client/postgres-client.js";
import { redactDatabaseUrl } from "./config.js";
import { PostgresProvider } from "./provider.js";

const baseConfig = {
  databaseUrl: "postgresql://user:secret@localhost:5432/app",
  queryTimeoutMs: 5000,
  longRunningThresholdMs: 30_000,
  maxConnectionWarning: 50,
};

function createMockClient(
  rowsByLabel: Record<string, Record<string, unknown>[]>,
  options: { connectFails?: boolean } = {},
): PostgresClientAdapter {
  return {
    connect: options.connectFails
      ? vi.fn().mockRejectedValue(new Error("connection refused"))
      : vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(!options.connectFails),
    query: vi.fn((sql: string, _params: unknown[] = [], label?: string) => {
      const key = label ?? "query";
      const rows = rowsByLabel[key] ?? [];
      return Promise.resolve({ rows, rowCount: rows.length });
    }) as PostgresClientAdapter["query"],
  };
}

const healthyRows: Record<string, Record<string, unknown>[]> = {
  ping: [{ ok: 1 }],
  version: [{ version: "PostgreSQL 16.2" }],
  database_size: [{ size_bytes: "1048576" }],
  connection_count: [{ count: 5 }],
  active_queries: [],
  long_running_queries: [],
  locks: [],
  migration_table_exists: [{ exists: true }],
  migration_table_status: [{ applied_count: 3, latest_migration: "20240101000000_init" }],
  table_stats: [
    {
      schema: "public",
      table: "users",
      live_tuples: 100,
      dead_tuples: 2,
      last_vacuum: null,
      last_autovacuum: "2026-01-01",
      last_analyze: null,
    },
  ],
};

describe("PostgresProvider", () => {
  it("reporta configurado con databaseUrl", () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });
    expect(provider.isConfigured()).toBe(true);
  });

  it("no configurado sin databaseUrl", () => {
    const provider = new PostgresProvider({
      config: { ...baseConfig, databaseUrl: "" },
    });
    expect(provider.isConfigured()).toBe(false);
  });

  it("ping devuelve ok y latencia", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    const result = await provider.ping();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("getVersion devuelve versión de PostgreSQL", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    expect(await provider.getVersion()).toBe("PostgreSQL 16.2");
  });

  it("getDatabaseSize y getConnectionCount", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    expect(await provider.getDatabaseSize()).toBe(1_048_576);
    expect(await provider.getConnectionCount()).toBe(5);
  });

  it("getTableStats parsea filas", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    const stats = await provider.getTableStats();
    expect(stats).toHaveLength(1);
    expect(stats[0]?.table).toBe("users");
    expect(stats[0]?.liveTuples).toBe(100);
  });

  it("getMigrationTableStatus cuando existe", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    const status = await provider.getMigrationTableStatus();
    expect(status.exists).toBe(true);
    expect(status.appliedCount).toBe(3);
    expect(status.latestMigration).toBe("20240101000000_init");
  });

  it("getMigrationTableStatus cuando no existe", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient({
        ...healthyRows,
        migration_table_exists: [{ exists: false }],
      }),
    });

    const status = await provider.getMigrationTableStatus();
    expect(status.exists).toBe(false);
    expect(status.appliedCount).toBeNull();
  });

  it("assessReleaseReadiness reporta estado listo", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.connected).toBe(true);
    expect(readiness.version).toBe("PostgreSQL 16.2");
    expect(readiness.databaseSize).toBe(1_048_576);
    expect(readiness.activeConnections).toBe(5);
    expect(readiness.migrationTableExists).toBe(true);
    expect(readiness.riskLevel).toBe("low");
    expect(readiness.blockers).toEqual([]);
    expect(readiness.recommendation).toContain("lista");
  });

  it("assessReleaseReadiness bloquea con queries largas", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient({
        ...healthyRows,
        long_running_queries: [
          {
            pid: 42,
            usename: "app",
            application_name: "api",
            state: "active",
            query: "SELECT pg_sleep(60)",
            query_start: "2026-01-01T00:00:00Z",
            wait_event_type: null,
            duration_ms: 60_000,
          },
        ],
      }),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.riskLevel).toBe("high");
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.longRunningQueries).toHaveLength(1);
  });

  it("assessReleaseReadiness bloquea con locks en espera", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient({
        ...healthyRows,
        locks: [
          {
            pid: 10,
            lock_type: "relation",
            mode: "AccessExclusiveLock",
            granted: false,
            relation: "users",
            query: "ALTER TABLE users",
          },
        ],
      }),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.riskLevel).toBe("high");
    expect(readiness.blockers.some((b) => b.includes("lock"))).toBe(true);
  });

  it("assessReleaseReadiness falla si no conecta", async () => {
    const provider = new PostgresProvider({
      config: baseConfig,
      client: createMockClient(healthyRows, { connectFails: true }),
    });

    const readiness = await provider.assessReleaseReadiness();

    expect(readiness.connected).toBe(false);
    expect(readiness.riskLevel).toBe("high");
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });
});

describe("redactDatabaseUrl", () => {
  it("oculta password en connection string", () => {
    const redacted = redactDatabaseUrl("postgresql://user:secret@localhost:5432/db");
    expect(redacted).not.toContain("secret");
    expect(redacted).toContain("***");
  });
});
