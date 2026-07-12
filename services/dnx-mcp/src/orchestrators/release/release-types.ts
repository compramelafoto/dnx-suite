/**
 * Tipos del Release Orchestrator.
 * Esta capa no conoce APIs externas — solo coordina MCP tools.
 */

import type { PlatformDefinition } from "../../platforms/types.js";
import type { DnxBrain } from "../../brain/brain.js";
import type { GitProvider } from "../../providers/git/provider.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import type { PrismaProvider } from "../../providers/prisma/provider.js";
import type { ReleaseReadiness as PrismaReleaseReadiness } from "../../providers/prisma/types/index.js";
import type { PostgresProvider } from "../../providers/postgres/provider.js";
import type { ReleaseReadiness as PostgresReleaseReadiness } from "../../providers/postgres/types/index.js";
import type { CloudflareProvider } from "../../providers/cloudflare/provider.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";
import type { ProviderRegistry } from "../../providers/registry/index.js";
import type { VercelProvider } from "../../providers/vercel/provider.js";
import type { ReleaseBrainAssessment } from "./release-brain.js";
import type { GitProviderResolver } from "./release-git.js";
import type { PrismaProviderResolver } from "./release-prisma.js";
import type { PostgresProviderResolver } from "./release-postgres.js";
import type { CloudflareProviderResolver } from "./release-cloudflare.js";

export type ReleaseToolName =
  | "vercel_status"
  | "vercel_prepare_staging"
  | "vercel_validate_staging"
  | "vercel_deploy_release"
  | "vercel_rollback_release";

/** Fases del ciclo de vida de un release. */
export type ReleasePhase =
  | "idle"
  | "preparing"
  | "prepared"
  | "validating"
  | "validated"
  | "executing"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back";

export type ReleaseDecision = "GO" | "NO-GO";

export type RiskLevel = "low" | "medium" | "high";

export interface ReleaseRisk {
  level: RiskLevel;
  source: string;
  message: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: "pending" | "ready" | "attention" | "failed";
  notes?: string;
}

export interface StepMetric {
  step: string;
  tool: ReleaseToolName;
  durationMs: number;
  success: boolean;
  dryRun: boolean;
}

export interface OrchestratorMetrics {
  totalDurationMs: number;
  steps: StepMetric[];
}

export interface ReleasePlan {
  platformId: string;
  platformName: string;
  vercelProject: string;
  candidateTarget: "production";
  steps: string[];
  risks: ReleaseRisk[];
  checklist: ChecklistItem[];
  readyForValidation: boolean;
  generatedAt: string;
}

export interface PrepareReleaseInput {
  platform: PlatformDefinition;
  dryRun?: boolean;
}

export interface ValidateReleaseInput {
  platform: PlatformDefinition;
  deploymentId?: string | undefined;
  dryRun?: boolean;
}

export interface ExecuteReleaseInput {
  platform: PlatformDefinition;
  target?: "production" | "preview" | "development";
  redeployFrom?: string | undefined;
  dryRun?: boolean;
  confirm?: boolean;
  timeoutMs?: number;
}

export interface RollbackReleaseInput {
  platform: PlatformDefinition;
  target?: "production" | "preview" | "development";
  dryRun?: boolean;
  confirm?: boolean;
  timeoutMs?: number;
}

/** Resultado consolidado de vercel_status para un proyecto. */
export interface StatusSnapshot {
  authenticatedUser: { id: string; email: string | null };
  team: { id: string; slug: string; name: string | null } | null;
  project: {
    id: string;
    name: string;
    framework: string | null;
    production: unknown;
    preview: unknown;
    domains: Array<{ name: string; verified: boolean }>;
    aliases: string[];
    lastDeploy: unknown;
    status: string;
    health: string;
  } | null;
  summary: { totalProjects: number; healthy: number; building: number; failed: number };
}

/** Resultado consolidado de vercel_prepare_staging. */
export interface StagingSnapshot {
  project: { id: string; name: string; framework: string | null; verified: boolean };
  deployments: { preview: unknown; production: unknown };
  environment: {
    differences: {
      onlyInPreview: string[];
      onlyInProduction: string[];
      changed: string[];
      equal: string[];
    };
    issues: Array<{ type: string; key: string; message: string }>;
  };
  domains: {
    preview: Array<{ name: string; verified: boolean }>;
    production: Array<{ name: string; verified: boolean }>;
    diff: { previewOnly: string[]; productionOnly: string[]; unverified: string[] };
  };
  aliases: string[];
  stagingReady: boolean;
  recommendations: string[];
}

export interface PrepareReleaseResult {
  phase: ReleasePhase;
  platformId: string;
  platformName: string;
  vercelProject: string;
  dryRun: boolean;
  status: StatusSnapshot | Record<string, unknown>;
  staging: StagingSnapshot | Record<string, unknown>;
  risks: ReleaseRisk[];
  checklist: ChecklistItem[];
  plan: ReleasePlan;
  brain: ReleaseBrainAssessment;
  git: GitReleaseReadiness | null;
  prisma: PrismaReleaseReadiness | null;
  postgres: PostgresReleaseReadiness | null;
  cloudflare: CloudflareReleaseReadiness | null;
  metrics: OrchestratorMetrics;
  report: Record<string, unknown>;
}

export interface ValidateReleaseResult {
  phase: ReleasePhase;
  platformId: string;
  platformName: string;
  vercelProject: string;
  dryRun: boolean;
  decision: ReleaseDecision;
  validation: Record<string, unknown>;
  issues: string[];
  brain: ReleaseBrainAssessment;
  git: GitReleaseReadiness | null;
  prisma: PrismaReleaseReadiness | null;
  postgres: PostgresReleaseReadiness | null;
  cloudflare: CloudflareReleaseReadiness | null;
  metrics: OrchestratorMetrics;
  report: Record<string, unknown>;
}

export interface ExecuteReleaseResult {
  phase: ReleasePhase;
  platformId: string;
  platformName: string;
  vercelProject: string;
  dryRun: boolean;
  executed: boolean;
  deployment: Record<string, unknown> | null;
  brain: ReleaseBrainAssessment | null;
  git: GitReleaseReadiness | null;
  prisma: PrismaReleaseReadiness | null;
  postgres: PostgresReleaseReadiness | null;
  cloudflare: CloudflareReleaseReadiness | null;
  report: Record<string, unknown>;
  metrics: OrchestratorMetrics;
}

export interface RollbackReleaseResult {
  phase: ReleasePhase;
  platformId: string;
  platformName: string;
  vercelProject: string;
  dryRun: boolean;
  executed: boolean;
  report: Record<string, unknown>;
  metrics: OrchestratorMetrics;
}

/**
 * Abstracción para invocar MCP tools sin conocer providers ni HTTP.
 * En producción usa handlers locales; en tests se inyecta un mock.
 */
export interface ToolInvoker {
  invoke<T>(tool: ReleaseToolName, input: Record<string, unknown>): Promise<T>;
}

export interface ReleaseOrchestratorOptions {
  invoker?: ToolInvoker;
  brain?: DnxBrain;
  providerRegistry?: ProviderRegistry;
  vercel?: VercelProvider;
  git?: GitProvider;
  getGitProvider?: GitProviderResolver;
  prisma?: PrismaProvider;
  getPrismaProvider?: PrismaProviderResolver;
  postgres?: PostgresProvider;
  getPostgresProvider?: PostgresProviderResolver;
  cloudflare?: CloudflareProvider;
  getCloudflareProvider?: CloudflareProviderResolver;
}
