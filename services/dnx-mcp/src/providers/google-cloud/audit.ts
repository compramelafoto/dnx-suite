import { logger } from "../../utils/index.js";
import type { GoogleCloudConfig } from "./config.js";
import type { GcpEnvironment, GcpRiskLevel } from "./types.js";
import { redactSecrets } from "./redact.js";

export interface GcpAuditEntry {
  timestamp: string;
  tool: string;
  projectId?: string | null;
  environment?: GcpEnvironment | null;
  resource?: string;
  action: string;
  riskLevel: GcpRiskLevel;
  dryRun: boolean;
  changed: boolean;
  result: "success" | "dry_run" | "error" | "blocked";
  durationMs?: number;
  errorCode?: string;
}

export function writeGcpAudit(config: GoogleCloudConfig, entry: Omit<GcpAuditEntry, "timestamp">): void {
  if (!config.auditLogEnabled) return;
  const payload = {
    ...entry,
    timestamp: new Date().toISOString(),
    service: "dnx-mcp",
    provider: "google-cloud",
  };
  logger.info(`[AUDIT][gcp] ${redactSecrets(JSON.stringify(payload))}`);
}
