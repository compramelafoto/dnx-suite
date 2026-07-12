import type { PrismaExecutor } from "../client/prisma-executor.js";
import {
  getMigrationStatusLocal,
  listMigrationFolders,
  parseMigrateStatusOutput,
} from "../parsers/index.js";
import type { MigrateStatus, MigrationInfo, MigrationStatusLocal } from "../types/index.js";

export class PrismaMigrationService {
  constructor(
    private readonly executor: PrismaExecutor,
    private readonly schemaPath: string,
    private readonly migrationsPath: string,
  ) {}

  listMigrations(): MigrationInfo[] {
    return listMigrationFolders(this.migrationsPath);
  }

  getLatestMigration(): string | null {
    const migrations = this.listMigrations();
    return migrations.at(-1)?.name ?? null;
  }

  getMigrationCount(): number {
    return this.listMigrations().length;
  }

  getMigrationStatusLocal(): MigrationStatusLocal {
    return getMigrationStatusLocal(this.migrationsPath);
  }

  async getMigrateStatus(): Promise<MigrateStatus> {
    const output = await this.executor.runText(["migrate", "status", "--schema", this.schemaPath]);

    return parseMigrateStatusOutput(output);
  }
}
