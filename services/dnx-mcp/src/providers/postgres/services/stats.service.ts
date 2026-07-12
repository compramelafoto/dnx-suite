import type { PostgresClientAdapter } from "../client/postgres-client.js";
import type { PostgresConfig } from "../config.js";
import {
  SQL_ACTIVE_QUERIES,
  SQL_CONNECTION_COUNT,
  SQL_DATABASE_SIZE,
  SQL_LOCKS,
  SQL_LONG_RUNNING_QUERIES,
  SQL_MIGRATION_TABLE_EXISTS,
  SQL_MIGRATION_TABLE_STATUS,
  SQL_TABLE_STATS,
} from "../queries/readonly-queries.js";
import type {
  ActiveQuery,
  LockInfo,
  LongRunningQuery,
  MigrationTableStatus,
  TableStat,
} from "../types/index.js";
import {
  activeQuerySchema,
  lockInfoSchema,
  migrationTableStatusSchema,
  tableStatSchema,
} from "../types/index.js";

export class PostgresStatsService {
  constructor(private readonly client: PostgresClientAdapter) {}

  async getDatabaseSize(): Promise<number> {
    const result = await this.client.query<{ size_bytes: string }>(
      SQL_DATABASE_SIZE,
      [],
      "database_size",
    );
    const raw = result.rows[0]?.size_bytes;
    return raw ? Number(raw) : 0;
  }

  async getConnectionCount(): Promise<number> {
    const result = await this.client.query<{ count: number }>(
      SQL_CONNECTION_COUNT,
      [],
      "connection_count",
    );
    return result.rows[0]?.count ?? 0;
  }

  async getTableStats(): Promise<TableStat[]> {
    const result = await this.client.query(SQL_TABLE_STATS, [], "table_stats");

    return result.rows.map((row) =>
      tableStatSchema.parse({
        schema: asString(row.schema) ?? "",
        table: asString(row.table) ?? "",
        liveTuples: Number(row.live_tuples ?? 0),
        deadTuples: Number(row.dead_tuples ?? 0),
        lastVacuum: asString(row.last_vacuum),
        lastAutovacuum: asString(row.last_autovacuum),
        lastAnalyze: asString(row.last_analyze),
      }),
    );
  }

  async getMigrationTableStatus(): Promise<MigrationTableStatus> {
    const existsResult = await this.client.query<{ exists: boolean }>(
      SQL_MIGRATION_TABLE_EXISTS,
      [],
      "migration_table_exists",
    );

    const exists = existsResult.rows[0]?.exists === true;

    if (!exists) {
      return migrationTableStatusSchema.parse({
        exists: false,
        appliedCount: null,
        latestMigration: null,
      });
    }

    const statusResult = await this.client.query<{
      applied_count: number;
      latest_migration: string | null;
    }>(SQL_MIGRATION_TABLE_STATUS, [], "migration_table_status");

    return migrationTableStatusSchema.parse({
      exists: true,
      appliedCount: statusResult.rows[0]?.applied_count ?? 0,
      latestMigration: statusResult.rows[0]?.latest_migration ?? null,
    });
  }
}

export class PostgresMonitoringService {
  constructor(
    private readonly client: PostgresClientAdapter,
    private readonly config: PostgresConfig,
  ) {}

  async getActiveQueries(): Promise<ActiveQuery[]> {
    const result = await this.client.query(SQL_ACTIVE_QUERIES, [], "active_queries");

    return result.rows.map((row) => mapActiveQuery(row));
  }

  async getLongRunningQueries(): Promise<LongRunningQuery[]> {
    const result = await this.client.query(
      SQL_LONG_RUNNING_QUERIES,
      [this.config.longRunningThresholdMs],
      "long_running_queries",
    );

    return result.rows.map((row) => ({
      ...mapActiveQuery(row),
      durationMs: Number(row.duration_ms ?? 0),
    }));
  }

  async getLocks(): Promise<LockInfo[]> {
    const result = await this.client.query(SQL_LOCKS, [], "locks");

    return result.rows.map((row) =>
      lockInfoSchema.parse({
        pid: Number(row.pid),
        lockType: asString(row.lock_type) ?? "",
        mode: asString(row.mode) ?? "",
        granted: row.granted === true,
        relation: asString(row.relation),
        query: asString(row.query),
      }),
    );
  }
}

function mapActiveQuery(row: Record<string, unknown>): ActiveQuery {
  return activeQuerySchema.parse({
    pid: Number(row.pid),
    usename: asString(row.usename),
    applicationName: asString(row.application_name),
    state: asString(row.state),
    query: asString(row.query),
    queryStart: asString(row.query_start),
    waitEventType: asString(row.wait_event_type),
  });
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}
