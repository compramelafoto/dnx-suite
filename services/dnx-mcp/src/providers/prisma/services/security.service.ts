import type { DriftRisk, RiskLevel } from "../types/index.js";
import { driftRiskSchema } from "../types/index.js";
import type { PrismaMigrationService } from "./migration.service.js";
import type { PrismaSchemaService } from "./schema.service.js";

export class PrismaSecurityService {
  constructor(
    private readonly schema: PrismaSchemaService,
    private readonly migrations: PrismaMigrationService,
  ) {}

  async hasPendingMigrations(): Promise<boolean> {
    const status = await this.migrations.getMigrateStatus();
    return status.pendingMigrations.length > 0;
  }

  async hasSchemaChanges(): Promise<boolean> {
    const formatDrift = await this.schema.hasFormatDrift();
    if (formatDrift) {
      return true;
    }

    const validation = await this.schema.validateSchema();
    return !validation.valid;
  }

  async detectDriftRisk(): Promise<DriftRisk> {
    const [validation, formatDrift, migrateStatus] = await Promise.all([
      this.schema.validateSchema(),
      this.schema.hasFormatDrift(),
      this.migrations.getMigrateStatus(),
    ]);

    const reasons: string[] = [];
    const schemaInvalid = !validation.valid;
    const pendingMigrations = migrateStatus.pendingMigrations.length > 0;

    if (schemaInvalid) {
      reasons.push("El schema Prisma no pasa validación");
    }

    if (formatDrift) {
      reasons.push("El schema no cumple prisma format --check");
    }

    if (pendingMigrations) {
      reasons.push(
        `${String(migrateStatus.pendingMigrations.length)} migración(es) pendiente(s) de aplicar`,
      );
    }

    if (!migrateStatus.databaseReachable) {
      reasons.push("No se pudo verificar el estado de migraciones contra la base de datos");
    }

    const level = calculateDriftLevel(schemaInvalid, formatDrift, pendingMigrations);

    return driftRiskSchema.parse({
      level,
      reasons,
      pendingMigrations,
      schemaInvalid,
      formatDrift,
    });
  }
}

function calculateDriftLevel(
  schemaInvalid: boolean,
  formatDrift: boolean,
  pendingMigrations: boolean,
): RiskLevel {
  if (schemaInvalid || pendingMigrations) {
    return "high";
  }
  if (formatDrift) {
    return "medium";
  }
  return "low";
}
