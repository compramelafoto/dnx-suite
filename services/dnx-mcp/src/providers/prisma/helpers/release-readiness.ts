import type { ReleaseReadiness, RiskLevel } from "../types/index.js";
import { releaseReadinessSchema } from "../types/index.js";
import type { PrismaMigrationService } from "../services/migration.service.js";
import type { PrismaSchemaService } from "../services/schema.service.js";
import type { PrismaSecurityService } from "../services/security.service.js";

export class PrismaReleaseHelpers {
  constructor(
    private readonly schema: PrismaSchemaService,
    private readonly migrations: PrismaMigrationService,
    private readonly security: PrismaSecurityService,
  ) {}

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    const [validation, driftRisk, migrateStatus, migrationCount, latestMigration, schemaHash] =
      await Promise.all([
        this.schema.validateSchema(),
        this.security.detectDriftRisk(),
        this.migrations.getMigrateStatus(),
        Promise.resolve(this.migrations.getMigrationCount()),
        Promise.resolve(this.migrations.getLatestMigration()),
        Promise.resolve(this.schema.getSchemaHash()),
      ]);

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!validation.valid) {
      blockers.push("Schema Prisma inválido — ejecutar prisma validate localmente");
    }

    if (driftRisk.pendingMigrations) {
      blockers.push(`Migraciones pendientes: ${migrateStatus.pendingMigrations.join(", ")}`);
    }

    if (driftRisk.formatDrift) {
      warnings.push("El schema no está formateado según prisma format");
    }

    if (!migrateStatus.databaseReachable) {
      warnings.push(
        "No se pudo conectar a la base de datos para verificar migrate status — revisar manualmente",
      );
    }

    if (migrationCount === 0) {
      warnings.push("No hay migraciones locales en el directorio de migraciones");
    }

    const riskLevel = calculateRiskLevel(blockers, warnings, driftRisk.level);
    const recommendation = buildRecommendation(blockers, warnings, riskLevel);

    return releaseReadinessSchema.parse({
      schemaValid: validation.valid,
      schemaPath: this.schema.getSchemaPath(),
      schemaHash,
      migrationCount,
      latestMigration,
      pendingMigrations: migrateStatus.pendingMigrations,
      driftRisk,
      riskLevel,
      blockers,
      warnings,
      recommendation,
    });
  }
}

function calculateRiskLevel(
  blockers: string[],
  warnings: string[],
  driftLevel: RiskLevel,
): RiskLevel {
  if (blockers.length > 0) {
    return "high";
  }
  if (warnings.length > 0 || driftLevel === "medium") {
    return "medium";
  }
  return "low";
}

function buildRecommendation(blockers: string[], warnings: string[], riskLevel: RiskLevel): string {
  if (blockers.length > 0) {
    return `No liberar hasta resolver Prisma: ${blockers.join("; ")}`;
  }
  if (warnings.length > 0) {
    return `Proceder con precaución (Prisma): ${warnings.join("; ")}`;
  }
  if (riskLevel === "low") {
    return "Estado Prisma listo para continuar con el pipeline de release";
  }
  return "Revisar estado Prisma antes de continuar";
}
