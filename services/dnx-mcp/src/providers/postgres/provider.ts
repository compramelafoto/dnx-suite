import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { Provider } from "../../types/provider.js";
import { PostgresClient, type PostgresClientAdapter } from "./client/postgres-client.js";
import {
  isPostgresConfigured,
  postgresConfigSchema,
  resolvePostgresConfig,
  type PostgresConfig,
} from "./config.js";
import { PostgresReleaseHelpers } from "./helpers/index.js";
import {
  PostgresConnectionService,
  PostgresMonitoringService,
  PostgresStatsService,
} from "./services/index.js";
import type {
  ActiveQuery,
  LockInfo,
  LongRunningQuery,
  MigrationTableStatus,
  PingResult,
  ReleaseReadiness,
  TableStat,
} from "./types/index.js";

export interface PostgresProviderOptions {
  config?: Partial<PostgresConfig>;
  client?: PostgresClientAdapter;
}

/**
 * Provider de PostgreSQL de solo lectura.
 * Evalúa estado de la base de datos sin modificar datos.
 */
export class PostgresProvider implements Provider {
  readonly name = "postgres" as const;

  readonly connection: PostgresConnectionService;
  readonly stats: PostgresStatsService;
  readonly monitoring: PostgresMonitoringService;
  readonly helpers: PostgresReleaseHelpers;

  private readonly config: PostgresConfig;
  private readonly client: PostgresClientAdapter;

  constructor(options: PostgresProviderOptions = {}) {
    this.config = resolvePostgresConfig(options.config);
    this.client =
      options.client ??
      new PostgresClient({
        config: this.config,
      });

    this.connection = new PostgresConnectionService(this.client);
    this.stats = new PostgresStatsService(this.client);
    this.monitoring = new PostgresMonitoringService(this.client, this.config);
    this.helpers = new PostgresReleaseHelpers(
      this.connection,
      this.stats,
      this.monitoring,
      this.config,
    );
  }

  isConfigured(): boolean {
    return isPostgresConfigured(this.config);
  }

  getConfig(): Readonly<PostgresConfig> {
    return this.config;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }
  }

  async connect(): Promise<void> {
    this.assertConfigured();
    await this.connection.connect();
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  async ping(): Promise<PingResult> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.connection.ping();
  }

  async getVersion(): Promise<string> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.connection.getVersion();
  }

  async getDatabaseSize(): Promise<number> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.stats.getDatabaseSize();
  }

  async getConnectionCount(): Promise<number> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.stats.getConnectionCount();
  }

  async getActiveQueries(): Promise<ActiveQuery[]> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.monitoring.getActiveQueries();
  }

  async getLongRunningQueries(): Promise<LongRunningQuery[]> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.monitoring.getLongRunningQueries();
  }

  async getLocks(): Promise<LockInfo[]> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.monitoring.getLocks();
  }

  async getTableStats(): Promise<TableStat[]> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.stats.getTableStats();
  }

  async getMigrationTableStatus(): Promise<MigrationTableStatus> {
    this.assertConfigured();
    await this.ensureConnected();
    return this.stats.getMigrationTableStatus();
  }

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    this.assertConfigured();
    return this.helpers.assessReleaseReadiness();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection.isConnected()) {
      await this.connection.connect();
    }
  }
}

export function createPostgresProvider(options: PostgresProviderOptions = {}): PostgresProvider {
  return new PostgresProvider(options);
}

export const postgresProvider = createPostgresProvider();

export { postgresConfigSchema, resolvePostgresConfig, type PostgresConfig };
