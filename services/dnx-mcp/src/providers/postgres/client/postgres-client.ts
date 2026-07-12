import pg from "pg";
import type { PostgresConfig } from "../config.js";
import { redactDatabaseUrl } from "../config.js";
import {
  PostgresConnectionError,
  PostgresForbiddenQueryError,
  PostgresQueryError,
  PostgresQueryTimeoutError,
} from "../errors.js";
import { assertReadOnlyQuery } from "../queries/readonly-queries.js";

export interface PostgresQueryResult<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface PostgresClientAdapter {
  connect(): Promise<void>;
  end(): Promise<void>;
  isConnected(): boolean;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
    label?: string,
  ): Promise<PostgresQueryResult<T>>;
}

export interface PostgresClientOptions {
  config: PostgresConfig;
  pool?: pg.Pool;
}

export class PostgresClient implements PostgresClientAdapter {
  private pool: pg.Pool | null;
  private connected = false;
  private readonly config: PostgresConfig;
  private readonly ownsPool: boolean;

  constructor(options: PostgresClientOptions) {
    this.config = options.config;

    if (options.pool) {
      this.pool = options.pool;
      this.ownsPool = false;
    } else {
      this.pool = new pg.Pool({
        connectionString: this.config.databaseUrl,
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: this.config.queryTimeoutMs,
        application_name: "dnx-mcp-readonly",
        options: "-c default_transaction_read_only=on",
      });
      this.ownsPool = true;
    }
  }

  async connect(): Promise<void> {
    if (!this.pool) {
      throw new PostgresConnectionError("Pool PostgreSQL no inicializado");
    }

    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new PostgresConnectionError(
        `No se pudo conectar a PostgreSQL (${redactDatabaseUrl(this.config.databaseUrl)})`,
        error,
      );
    }
  }

  async end(): Promise<void> {
    if (this.pool && this.ownsPool) {
      await this.pool.end();
    }
    this.pool = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    label = "query",
  ): Promise<PostgresQueryResult<T>> {
    if (!this.pool) {
      throw new PostgresConnectionError("Cliente PostgreSQL no conectado");
    }

    try {
      assertReadOnlyQuery(sql, label);
    } catch (error) {
      throw new PostgresForbiddenQueryError(error instanceof Error ? error.message : String(error));
    }

    const timeoutMs = this.config.queryTimeoutMs;

    try {
      const result = await Promise.race([
        this.pool.query<T>({ text: sql, values: params }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new PostgresQueryTimeoutError(label, timeoutMs));
          }, timeoutMs);
        }),
      ]);

      return {
        rows: result.rows,
        rowCount: result.rowCount,
      };
    } catch (error) {
      if (error instanceof PostgresQueryTimeoutError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      if (/timeout|timed out|canceling statement/i.test(message)) {
        throw new PostgresQueryTimeoutError(label, timeoutMs);
      }

      throw new PostgresQueryError(`Error ejecutando ${label}`, label, error);
    }
  }
}
