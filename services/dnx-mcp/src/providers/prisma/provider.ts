import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { Provider } from "../../types/provider.js";
import { PrismaExecutor } from "./client/prisma-executor.js";
import {
  isPrismaConfigured,
  prismaConfigSchema,
  resolvePrismaConfig,
  type PrismaConfig,
} from "./config.js";
import { PrismaSchemaNotFoundError } from "./errors.js";
import { PrismaReleaseHelpers } from "./helpers/index.js";
import {
  PrismaMigrationService,
  PrismaSchemaService,
  PrismaSecurityService,
} from "./services/index.js";
import type {
  DriftRisk,
  MigrateStatus,
  MigrationInfo,
  MigrationStatusLocal,
  ReleaseReadiness,
  SchemaStats,
  SchemaValidation,
} from "./types/index.js";

export interface PrismaProviderOptions {
  config?: Partial<PrismaConfig>;
  executor?: PrismaExecutor;
}

/**
 * Provider de Prisma de solo lectura.
 * Inspecciona schema y migraciones sin modificar la base de datos.
 */
export class PrismaProvider implements Provider {
  readonly name = "prisma" as const;

  readonly schema: PrismaSchemaService;
  readonly migrations: PrismaMigrationService;
  readonly security: PrismaSecurityService;
  readonly helpers: PrismaReleaseHelpers;

  private readonly config: PrismaConfig;
  private readonly executor: PrismaExecutor;

  constructor(options: PrismaProviderOptions = {}) {
    this.config = resolvePrismaConfig(options.config);
    this.executor =
      options.executor ??
      new PrismaExecutor({
        binary: this.config.binary,
        cwd: this.config.cwd,
      });

    this.schema = new PrismaSchemaService(this.executor, this.config.schemaPath);
    this.migrations = new PrismaMigrationService(
      this.executor,
      this.config.schemaPath,
      this.config.migrationsPath,
    );
    this.security = new PrismaSecurityService(this.schema, this.migrations);
    this.helpers = new PrismaReleaseHelpers(this.schema, this.migrations, this.security);
  }

  isConfigured(): boolean {
    return isPrismaConfigured(this.config);
  }

  getConfig(): Readonly<PrismaConfig> {
    return this.config;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.name);
    }
  }

  private assertSchema(): void {
    this.assertConfigured();
    if (!this.schema.schemaExists()) {
      throw new PrismaSchemaNotFoundError(this.config.schemaPath);
    }
  }

  // --- Schema ---

  getSchemaPath(): string {
    return this.schema.getSchemaPath();
  }

  schemaExists(): boolean {
    return this.schema.schemaExists();
  }

  async validateSchema(): Promise<SchemaValidation> {
    this.assertSchema();
    return this.schema.validateSchema();
  }

  getSchemaHash(): string {
    this.assertSchema();
    return this.schema.getSchemaHash();
  }

  getSchemaStats(): SchemaStats {
    this.assertSchema();
    return this.schema.getSchemaStats();
  }

  // --- Migraciones locales ---

  listMigrations(): MigrationInfo[] {
    return this.migrations.listMigrations();
  }

  getLatestMigration(): string | null {
    return this.migrations.getLatestMigration();
  }

  getMigrationCount(): number {
    return this.migrations.getMigrationCount();
  }

  getMigrationStatusLocal(): MigrationStatusLocal {
    return this.migrations.getMigrationStatusLocal();
  }

  // --- Estado seguro ---

  async hasPendingMigrations(): Promise<boolean> {
    this.assertSchema();
    return this.security.hasPendingMigrations();
  }

  async hasSchemaChanges(): Promise<boolean> {
    this.assertSchema();
    return this.security.hasSchemaChanges();
  }

  async detectDriftRisk(): Promise<DriftRisk> {
    this.assertSchema();
    return this.security.detectDriftRisk();
  }

  async getMigrateStatus(): Promise<MigrateStatus> {
    this.assertSchema();
    return this.migrations.getMigrateStatus();
  }

  // --- Helpers de alto nivel ---

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    this.assertSchema();
    return this.helpers.assessReleaseReadiness();
  }
}

export function createPrismaProvider(options: PrismaProviderOptions = {}): PrismaProvider {
  return new PrismaProvider(options);
}

export const prismaProvider = createPrismaProvider();

export { prismaConfigSchema, resolvePrismaConfig, type PrismaConfig };
