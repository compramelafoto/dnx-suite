import type { BrainSignal } from "../../brain/types.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import type { PrismaProvider } from "../../providers/prisma/provider.js";
import type { ReleaseReadiness } from "../../providers/prisma/types/index.js";

export const HIGH_MIGRATION_COUNT_THRESHOLD = 30;

export function prismaHasCriticalBlockers(readiness: ReleaseReadiness): boolean {
  return (
    readiness.blockers.length > 0 ||
    readiness.riskLevel === "high" ||
    !readiness.schemaValid ||
    readiness.pendingMigrations.length > 0 ||
    readiness.driftRisk.formatDrift ||
    readiness.driftRisk.schemaInvalid ||
    readiness.driftRisk.level === "high"
  );
}

export function assertPrismaAllowsReleaseExecution(readiness: ReleaseReadiness): void {
  const blockers: string[] = [];

  if (!readiness.schemaValid) {
    blockers.push("Schema Prisma inválido");
  }
  if (readiness.pendingMigrations.length > 0) {
    blockers.push(`Migraciones pendientes: ${readiness.pendingMigrations.join(", ")}`);
  }
  if (readiness.driftRisk.formatDrift) {
    blockers.push("Drift de formato en schema Prisma");
  }
  if (readiness.driftRisk.schemaInvalid) {
    blockers.push("Schema Prisma con errores de validación");
  }
  if (readiness.riskLevel === "high") {
    blockers.push("Prisma riskLevel alto");
  }

  if (blockers.length > 0) {
    throw new PrismaReleaseBlockedError(blockers);
  }
}

export class PrismaReleaseBlockedError extends Error {
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`Release bloqueado por estado Prisma: ${blockers.join("; ")}`);
    this.name = "PrismaReleaseBlockedError";
    this.blockers = blockers;
  }
}

export function appendPrismaSignals(readiness: ReleaseReadiness, signals: BrainSignal[]): void {
  const hasPending = readiness.pendingMigrations.length > 0;
  const highMigrationCount = readiness.migrationCount > HIGH_MIGRATION_COUNT_THRESHOLD;

  signals.push({
    source: "prisma",
    type: "state",
    key: "prisma.schemaValid",
    message: readiness.schemaValid
      ? "Schema Prisma válido"
      : "Schema Prisma inválido — revisar prisma validate",
    value: readiness.schemaValid,
    ...(!readiness.schemaValid ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "prisma",
    type: "metric",
    key: "prisma.migrationCount",
    message: `${String(readiness.migrationCount)} migración(es) local(es)`,
    value: readiness.migrationCount,
    ...(highMigrationCount ? { severity: "medium" as const } : {}),
  });

  signals.push({
    source: "prisma",
    type: "state",
    key: "prisma.hasPendingMigrations",
    message: hasPending
      ? `${String(readiness.pendingMigrations.length)} migración(es) pendiente(s) de aplicar`
      : "Sin migraciones pendientes",
    value: hasPending,
    ...(hasPending ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "prisma",
    type: "state",
    key: "prisma.formatDrift",
    message: readiness.driftRisk.formatDrift
      ? "Schema no cumple prisma format --check"
      : "Formato de schema correcto",
    value: readiness.driftRisk.formatDrift,
    ...(readiness.driftRisk.formatDrift ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "prisma",
    type: "risk",
    key: "prisma.driftRisk",
    message: `Riesgo de drift Prisma: ${readiness.driftRisk.level} — ${readiness.driftRisk.reasons.join("; ") || "sin razones"}`,
    value: readiness.driftRisk.level,
    severity:
      readiness.driftRisk.level === "high"
        ? "high"
        : readiness.driftRisk.level === "medium"
          ? "medium"
          : "low",
  });

  signals.push({
    source: "prisma",
    type: "risk",
    key: "prisma.riskLevel",
    message: `Nivel de riesgo Prisma: ${readiness.riskLevel}`,
    value: readiness.riskLevel,
    severity:
      readiness.riskLevel === "high" ? "high" : readiness.riskLevel === "medium" ? "medium" : "low",
  });

  if (readiness.latestMigration) {
    signals.push({
      source: "prisma",
      type: "state",
      key: "prisma.latestMigration",
      message: `Última migración local: ${readiness.latestMigration}`,
      value: readiness.latestMigration,
    });
  }

  for (const blocker of readiness.blockers) {
    signals.push({
      source: "prisma",
      type: "risk",
      key: "prisma.blocker",
      message: blocker,
      severity: "high",
    });
  }

  for (const warning of readiness.warnings) {
    signals.push({
      source: "prisma",
      type: "issue",
      key: "prisma.warning",
      message: warning,
      severity: "medium",
    });
  }
}

export function formatPrismaReport(readiness: ReleaseReadiness): Record<string, unknown> {
  return {
    schemaValid: readiness.schemaValid,
    schemaPath: readiness.schemaPath,
    schemaHash: readiness.schemaHash,
    migrationCount: readiness.migrationCount,
    latestMigration: readiness.latestMigration,
    pendingMigrations: readiness.pendingMigrations,
    driftRisk: readiness.driftRisk,
    riskLevel: readiness.riskLevel,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    recommendation: readiness.recommendation,
  };
}

export type PrismaProviderResolver = (platform: PlatformDefinition) => PrismaProvider | undefined;

export function resolvePrismaProvider(
  platform: PlatformDefinition,
  options: {
    prisma?: PrismaProvider | undefined;
    getPrismaProvider?: PrismaProviderResolver | undefined;
  },
): PrismaProvider | undefined {
  return options.getPrismaProvider?.(platform) ?? options.prisma;
}
