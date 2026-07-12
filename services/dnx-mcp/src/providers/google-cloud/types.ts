export type GcpRiskLevel =
  | "READ_ONLY"
  | "LOW_RISK_WRITE"
  | "HIGH_RISK_WRITE"
  | "DESTRUCTIVE";

export type GcpEnvironment = "development" | "staging" | "production";

export type GcpErrorCode =
  | "GCP_DISABLED"
  | "GCP_CLI_NOT_INSTALLED"
  | "GCP_CLI_EXECUTION_FAILED"
  | "GCP_NOT_AUTHENTICATED"
  | "GCP_ACCOUNT_NOT_FOUND"
  | "GCP_PROJECT_REQUIRED"
  | "GCP_PROJECT_NOT_FOUND"
  | "GCP_PROJECT_NOT_ALLOWED"
  | "GCP_BILLING_NOT_ENABLED"
  | "GCP_PERMISSION_DENIED"
  | "GCP_INVALID_SERVICE"
  | "GCP_SERVICE_ENABLE_FAILED"
  | "GCP_SERVICE_ACCOUNT_EXISTS"
  | "GCP_SERVICE_ACCOUNT_CREATE_FAILED"
  | "GCP_SECRET_EXISTS"
  | "GCP_SECRET_NOT_FOUND"
  | "GCP_SECRET_CREATE_FAILED"
  | "GCP_SECRET_VERSION_FAILED"
  | "GCP_WRITE_BLOCKED"
  | "GCP_PRODUCTION_WRITE_BLOCKED"
  | "GCP_CONFIRMATION_REQUIRED"
  | "GCP_DESTRUCTIVE_OPERATION_BLOCKED"
  | "GCP_TIMEOUT"
  | "GCP_OUTPUT_TOO_LARGE"
  | "GCP_INVALID_INPUT"
  | "GCP_KEYS_BLOCKED";

export interface GcpStructuredError {
  code: GcpErrorCode;
  message: string;
  resource?: string;
  projectId?: string;
  cause?: string;
  recommendedAction?: string;
}

export interface GcpToolResultBase {
  success: boolean;
  changed: boolean;
  dryRun: boolean;
  riskLevel: GcpRiskLevel;
  projectId?: string | null;
  environment?: GcpEnvironment | null;
  actions: string[];
  warnings: string[];
  errors: GcpStructuredError[];
  metadata: Record<string, unknown>;
}

export interface GcpAccount {
  account: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface GcpProjectSummary {
  projectId: string;
  name: string;
  projectNumber?: string;
  lifecycleState?: string;
  labels?: Record<string, string>;
}

export interface GcpServiceAccountSummary {
  email: string;
  uniqueId?: string;
  displayName?: string;
  disabled?: boolean;
}

export interface GcpSecretMetadata {
  name: string;
  secretId: string;
  createTime?: string;
  labels?: Record<string, string>;
  replication?: unknown;
}

/** Comandos tipados permitidos — nunca strings libres del usuario. */
export type GcpAllowedCommand =
  | { op: "version" }
  | { op: "info" }
  | { op: "auth.list" }
  | { op: "config.get"; key: "core/account" | "core/project" }
  | { op: "config.set"; key: "core/project"; value: string }
  | { op: "projects.list" }
  | { op: "projects.describe"; projectId: string }
  | { op: "billing.describe"; projectId: string }
  | { op: "services.list.enabled"; projectId: string }
  | { op: "services.list.available"; projectId: string }
  | { op: "services.enable"; projectId: string; services: readonly string[] }
  | { op: "iam.sa.list"; projectId: string }
  | {
      op: "iam.sa.create";
      projectId: string;
      accountId: string;
      displayName?: string;
      description?: string;
    }
  | { op: "secrets.list"; projectId: string }
  | { op: "secrets.describe"; projectId: string; secretId: string }
  | {
      op: "secrets.create";
      projectId: string;
      secretId: string;
      replication: "automatic";
    }
  | {
      op: "secrets.versions.add";
      projectId: string;
      secretId: string;
      /** Valor sensible: solo via stdin, nunca en argv/logs. */
      secretValue: string;
    };

export interface GcpRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  args: readonly string[];
  durationMs: number;
}
