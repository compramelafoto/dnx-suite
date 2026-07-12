import type { LockInfo, LongRunningQuery, ReleaseReadiness, RiskLevel } from "../types/index.js";
import { releaseReadinessSchema } from "../types/index.js";
import type { PostgresConfig } from "../config.js";
import type { PostgresConnectionService } from "../services/connection.service.js";
import type { PostgresMonitoringService, PostgresStatsService } from "../services/stats.service.js";

export class PostgresReleaseHelpers {
  constructor(
    private readonly connection: PostgresConnectionService,
    private readonly stats: PostgresStatsService,
    private readonly monitoring: PostgresMonitoringService,
    private readonly config: PostgresConfig,
  ) {}

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    let connected = false;
    let version: string | null = null;
    let databaseSize: number | null = null;
    let activeConnections = 0;
    let longRunningQueries: LongRunningQuery[] = [];
    let locks: LockInfo[] = [];
    let migrationTableExists = false;

    try {
      if (!this.connection.isConnected()) {
        await this.connection.connect();
      }

      const ping = await this.connection.ping();
      connected = ping.ok;

      if (!connected) {
        blockers.push("No se pudo hacer ping a PostgreSQL");
      } else {
        version = await this.connection.getVersion();
        databaseSize = await this.stats.getDatabaseSize();
        activeConnections = await this.stats.getConnectionCount();
        longRunningQueries = await this.monitoring.getLongRunningQueries();
        locks = await this.monitoring.getLocks();

        const migrationStatus = await this.stats.getMigrationTableStatus();
        migrationTableExists = migrationStatus.exists;

        if (longRunningQueries.length > 0) {
          blockers.push(
            `${String(longRunningQueries.length)} query(s) de larga duración (>${String(this.config.longRunningThresholdMs)}ms)`,
          );
        }

        const blockingLocks = locks.filter((lock) => !lock.granted);
        if (blockingLocks.length > 0) {
          blockers.push(`${String(blockingLocks.length)} lock(s) en espera`);
        }

        if (activeConnections >= this.config.maxConnectionWarning) {
          warnings.push(
            `${String(activeConnections)} conexiones activas — revisar pool antes del release`,
          );
        }

        if (!migrationTableExists) {
          warnings.push("Tabla _prisma_migrations no encontrada en public");
        }
      }
    } catch {
      connected = false;
      blockers.push("No se pudo conectar o evaluar PostgreSQL");
    }

    const riskLevel = calculateRiskLevel(blockers, warnings);
    const recommendation = buildRecommendation(blockers, warnings, riskLevel);

    return releaseReadinessSchema.parse({
      connected,
      version,
      databaseSize,
      activeConnections,
      longRunningQueries,
      locks,
      migrationTableExists,
      riskLevel,
      blockers,
      warnings,
      recommendation,
    });
  }
}

function calculateRiskLevel(blockers: string[], warnings: string[]): RiskLevel {
  if (blockers.length > 0) {
    return "high";
  }
  if (warnings.length > 0) {
    return "medium";
  }
  return "low";
}

function buildRecommendation(blockers: string[], warnings: string[], riskLevel: RiskLevel): string {
  if (blockers.length > 0) {
    return `No liberar hasta resolver PostgreSQL: ${blockers.join("; ")}`;
  }
  if (warnings.length > 0) {
    return `Proceder con precaución (PostgreSQL): ${warnings.join("; ")}`;
  }
  if (riskLevel === "low") {
    return "Base de datos PostgreSQL lista para continuar con el pipeline de release";
  }
  return "Revisar estado de PostgreSQL antes de continuar";
}
