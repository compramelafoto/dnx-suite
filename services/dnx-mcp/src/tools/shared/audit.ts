import { logger } from "../../utils/index.js";

export type AuditOutcome = "success" | "skipped" | "error" | "dry_run";

export interface AuditRecord {
  tool: string;
  action: string;
  project?: string;
  dryRun: boolean;
  confirmed: boolean;
  outcome: AuditOutcome;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registro de auditoría estructurado para todas las MCP tools.
 * Escribe en stderr vía logger para no interferir con el transporte MCP stdio.
 */
export function audit(record: AuditRecord): void {
  const entry = {
    ...record,
    timestamp: new Date().toISOString(),
    service: "dnx-mcp",
  };

  logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
}

export async function withAudit<T>(
  record: Omit<AuditRecord, "outcome" | "durationMs">,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await operation();
    audit({
      ...record,
      outcome: record.dryRun ? "dry_run" : "success",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    audit({
      ...record,
      outcome: "error",
      durationMs: Date.now() - startedAt,
      metadata: {
        ...record.metadata,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
