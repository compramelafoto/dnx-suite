import type { BrainSignal } from "../../brain/types.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import type { PostgresProvider } from "../../providers/postgres/provider.js";
import type { ReleaseReadiness } from "../../providers/postgres/types/index.js";

export const HIGH_CONNECTION_COUNT_THRESHOLD = 50;

export function getBlockingLocks(readiness: ReleaseReadiness) {
  return readiness.locks.filter((lock) => !lock.granted);
}

export function describePostgresBlockers(readiness: ReleaseReadiness): string[] {
  const blockers = [...readiness.blockers];

  if (!readiness.connected && !blockers.some((b) => b.includes("conectar"))) {
    blockers.push("PostgreSQL no conectado");
  }
  if (!readiness.migrationTableExists && !blockers.some((b) => b.includes("_prisma_migrations"))) {
    blockers.push("Tabla _prisma_migrations no encontrada");
  }
  if (
    readiness.longRunningQueries.length > 0 &&
    !blockers.some((b) => b.includes("larga duración"))
  ) {
    blockers.push(`${String(readiness.longRunningQueries.length)} query(s) de larga duración`);
  }
  const blockingLocks = getBlockingLocks(readiness);
  if (blockingLocks.length > 0 && !blockers.some((b) => b.includes("lock"))) {
    blockers.push(`${String(blockingLocks.length)} lock(s) en espera`);
  }

  return blockers;
}

export function postgresHasCriticalBlockers(readiness: ReleaseReadiness): boolean {
  return (
    !readiness.connected ||
    readiness.riskLevel === "high" ||
    readiness.blockers.length > 0 ||
    readiness.longRunningQueries.length > 0 ||
    getBlockingLocks(readiness).length > 0 ||
    !readiness.migrationTableExists
  );
}

export function assertPostgresAllowsReleaseExecution(readiness: ReleaseReadiness): void {
  const blockers: string[] = [];

  if (!readiness.connected) {
    blockers.push("PostgreSQL no conectado");
  }
  if (!readiness.migrationTableExists) {
    blockers.push("Tabla _prisma_migrations no encontrada");
  }
  if (readiness.longRunningQueries.length > 0) {
    blockers.push(
      `${String(readiness.longRunningQueries.length)} query(s) de larga duración activa(s)`,
    );
  }
  const blockingLocks = getBlockingLocks(readiness);
  if (blockingLocks.length > 0) {
    blockers.push(`${String(blockingLocks.length)} lock(s) en espera`);
  }
  if (readiness.riskLevel === "high") {
    blockers.push("PostgreSQL riskLevel alto");
  }
  if (readiness.blockers.length > 0) {
    blockers.push(...readiness.blockers);
  }

  if (blockers.length > 0) {
    throw new PostgresReleaseBlockedError(blockers);
  }
}

export class PostgresReleaseBlockedError extends Error {
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`Release bloqueado por estado PostgreSQL: ${blockers.join("; ")}`);
    this.name = "PostgresReleaseBlockedError";
    this.blockers = blockers;
  }
}

export function appendPostgresSignals(readiness: ReleaseReadiness, signals: BrainSignal[]): void {
  const blockingLocks = getBlockingLocks(readiness);
  const highConnections = readiness.activeConnections >= HIGH_CONNECTION_COUNT_THRESHOLD;

  signals.push({
    source: "postgres",
    type: "state",
    key: "postgres.connected",
    message: readiness.connected
      ? "PostgreSQL conectado"
      : "PostgreSQL no conectado — no se pudo evaluar la base",
    value: readiness.connected,
    ...(!readiness.connected ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "postgres",
    type: "risk",
    key: "postgres.riskLevel",
    message: `Nivel de riesgo PostgreSQL: ${readiness.riskLevel}`,
    value: readiness.riskLevel,
    severity:
      readiness.riskLevel === "high" ? "high" : readiness.riskLevel === "medium" ? "medium" : "low",
  });

  signals.push({
    source: "postgres",
    type: "metric",
    key: "postgres.activeConnections",
    message: `${String(readiness.activeConnections)} conexión(es) activa(s)`,
    value: readiness.activeConnections,
    ...(highConnections ? { severity: "medium" as const } : {}),
  });

  signals.push({
    source: "postgres",
    type: "metric",
    key: "postgres.longRunningQueries",
    message:
      readiness.longRunningQueries.length > 0
        ? `${String(readiness.longRunningQueries.length)} query(s) de larga duración`
        : "Sin queries de larga duración",
    value: readiness.longRunningQueries.length,
    ...(readiness.longRunningQueries.length > 0 ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "postgres",
    type: "metric",
    key: "postgres.locks",
    message:
      blockingLocks.length > 0
        ? `${String(blockingLocks.length)} lock(s) bloqueante(s)`
        : `${String(readiness.locks.length)} lock(s) sin bloqueos críticos`,
    value: blockingLocks.length,
    ...(blockingLocks.length > 0 ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "postgres",
    type: "state",
    key: "postgres.migrationTableExists",
    message: readiness.migrationTableExists
      ? "Tabla _prisma_migrations presente"
      : "Tabla _prisma_migrations no encontrada en public",
    value: readiness.migrationTableExists,
    ...(!readiness.migrationTableExists ? { severity: "high" as const } : {}),
  });

  for (const blocker of readiness.blockers) {
    signals.push({
      source: "postgres",
      type: "risk",
      key: "postgres.blocker",
      message: blocker,
      severity: "high",
    });
  }

  for (const warning of readiness.warnings) {
    signals.push({
      source: "postgres",
      type: "issue",
      key: "postgres.warning",
      message: warning,
      severity: "medium",
    });
  }
}

export function formatPostgresReport(readiness: ReleaseReadiness): Record<string, unknown> {
  return {
    connected: readiness.connected,
    version: readiness.version,
    databaseSize: readiness.databaseSize,
    activeConnections: readiness.activeConnections,
    longRunningQueries: readiness.longRunningQueries,
    locks: readiness.locks,
    migrationTableExists: readiness.migrationTableExists,
    riskLevel: readiness.riskLevel,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    recommendation: readiness.recommendation,
  };
}

export type PostgresProviderResolver = (
  platform: PlatformDefinition,
) => PostgresProvider | undefined;

export function resolvePostgresProvider(
  platform: PlatformDefinition,
  options: {
    postgres?: PostgresProvider | undefined;
    getPostgresProvider?: PostgresProviderResolver | undefined;
  },
): PostgresProvider | undefined {
  return options.getPostgresProvider?.(platform) ?? options.postgres;
}
