import { DnxBrain } from "../../brain/index.js";
import { OPERATION_MIN_SCORE, SCORE_THRESHOLDS } from "../../brain/knowledge/index.js";
import type {
  BrainDecision,
  BrainOperation,
  BrainSignal,
  SignalSeverity,
} from "../../brain/types.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import type { ReleaseReadiness as PrismaReleaseReadiness } from "../../providers/prisma/types/index.js";
import type { ReleaseReadiness as PostgresReleaseReadiness } from "../../providers/postgres/types/index.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";
import type {
  ChecklistItem,
  ReleaseDecision,
  ReleaseRisk,
  StagingSnapshot,
  StatusSnapshot,
} from "./release-types.js";
import {
  appendGitSignals,
  getAllowedReleaseBranches,
  gitHasCriticalBlockers,
  inferReleaseGitTarget,
  isStagingGitPolicyContext,
  type ReleaseGitPolicyContext,
} from "./release-git.js";
import { appendPrismaSignals, prismaHasCriticalBlockers } from "./release-prisma.js";
import {
  appendPostgresSignals,
  describePostgresBlockers,
  postgresHasCriticalBlockers,
} from "./release-postgres.js";
import {
  appendCloudflareSignals,
  cloudflareHasCriticalBlockers,
  describeCloudflareBlockers,
} from "./release-cloudflare.js";
import { normalizeVercelStatusSnapshot } from "./release-vercel-status.js";

export interface ReleaseBrainInput {
  operation: BrainOperation;
  platform: PlatformDefinition;
  dryRun: boolean;
  phase: string;
  status: StatusSnapshot | Record<string, unknown>;
  staging: StagingSnapshot | Record<string, unknown>;
  validation?: Record<string, unknown> | undefined;
  risks: ReleaseRisk[];
  checklist: ChecklistItem[];
  issues: string[];
  validationDecision?: ReleaseDecision | undefined;
  gitReadiness?: GitReleaseReadiness | null | undefined;
  prismaReadiness?: PrismaReleaseReadiness | null | undefined;
  postgresReadiness?: PostgresReleaseReadiness | null | undefined;
  cloudflareReadiness?: CloudflareReleaseReadiness | null | undefined;
  gitPolicyContext?: ReleaseGitPolicyContext | undefined;
}

export type ReleaseBrainAssessment = Pick<
  BrainDecision,
  | "score"
  | "confidence"
  | "verdict"
  | "reasoning"
  | "recommendation"
  | "nextActions"
  | "risks"
  | "inconsistencies"
  | "rejected"
  | "shouldBlock"
>;

export function buildReleaseBrainSignals(input: ReleaseBrainInput): BrainSignal[] {
  const signals: BrainSignal[] = [];

  for (const risk of input.risks) {
    signals.push({
      source: risk.source,
      type: "risk",
      key: `risk.${risk.source}`,
      message: risk.message,
      severity: toBrainSeverity(risk.level),
    });
  }

  for (const item of input.checklist) {
    signals.push({
      source: "release-checklist",
      type: "checklist",
      key: item.id,
      message: item.label,
      value: item.status === "ready",
      ...(item.status === "failed" ? { severity: "high" as const } : {}),
    });
  }

  for (const issue of input.issues) {
    signals.push({
      source: "release-validation",
      type: "issue",
      key: "validation.issue",
      message: issue,
      severity: "high",
    });
  }

  appendStatusSignals(input.status, input.staging, signals);
  appendStagingSignals(input.staging, signals);
  appendValidationSignals(input.validation, input.validationDecision, input.issues, signals);
  appendPolicySignals(input.platform, signals);

  if (input.gitReadiness) {
    appendGitSignals(input.gitReadiness, input.platform, signals, input.gitPolicyContext);
  }

  if (input.prismaReadiness) {
    appendPrismaSignals(input.prismaReadiness, signals);
  }

  if (input.postgresReadiness) {
    appendPostgresSignals(input.postgresReadiness, signals);
  }

  if (input.cloudflareReadiness) {
    appendCloudflareSignals(input.cloudflareReadiness, signals);
  }

  return signals;
}

export function evaluateReleaseBrain(
  brain: DnxBrain,
  input: ReleaseBrainInput,
): ReleaseBrainAssessment {
  const brainInput = {
    context: {
      operation: input.operation,
      platformId: input.platform.id,
      platformName: input.platform.name,
      phase: input.phase,
      dryRun: input.dryRun,
      orchestrator: "release",
    },
    signals: buildReleaseBrainSignals(input),
  };

  const decision = brain.evaluate(brainInput, { recordHistory: false });

  return {
    score: decision.score,
    confidence: decision.confidence,
    verdict: decision.verdict,
    reasoning: decision.reasoning,
    recommendation: decision.recommendation,
    nextActions: decision.nextActions,
    risks: decision.risks,
    inconsistencies: decision.inconsistencies,
    rejected: decision.rejected,
    shouldBlock: decision.shouldBlock,
  };
}

export interface StagingBrainPolicyInput {
  operation: ReleaseBrainInput["operation"];
  platform: PlatformDefinition;
  dryRun: boolean;
  validationPassed?: boolean;
  gitPolicyContext?: ReleaseGitPolicyContext;
  gitReadiness?: GitReleaseReadiness | null;
  prismaReadiness?: PrismaReleaseReadiness | null;
  postgresReadiness?: PostgresReleaseReadiness | null;
  cloudflareReadiness?: CloudflareReleaseReadiness | null;
}

function providersAllowStagingValidate(input: StagingBrainPolicyInput): boolean {
  const git = input.gitReadiness;
  if (!git || !getAllowedReleaseBranches(input.platform).includes(git.branch)) {
    return false;
  }
  if (gitHasCriticalBlockers(git)) {
    return false;
  }
  if (input.prismaReadiness && prismaHasCriticalBlockers(input.prismaReadiness)) {
    return false;
  }
  if (input.postgresReadiness && postgresHasCriticalBlockers(input.postgresReadiness)) {
    return false;
  }
  // Cloudflare/R2 solo bloquea QA de fotos cuando la plataforma declara assets.
  if (input.cloudflareReadiness && cloudflareHasCriticalBlockers(input.cloudflareReadiness)) {
    return false;
  }
  return true;
}

/**
 * En validate de staging, no bloquear por warnings esperados (rama/upstream, env diffs)
 * cuando la rama está permitida, providers OK y —en validate real— Vercel pasó.
 */
export function applyStagingDryRunBrainPolicy(
  brain: ReleaseBrainAssessment,
  input: StagingBrainPolicyInput,
): ReleaseBrainAssessment {
  if (input.operation !== "release.validate") {
    return brain;
  }

  const policyContext = input.gitPolicyContext ?? {
    dryRun: input.dryRun,
    target: inferReleaseGitTarget(input.platform),
  };

  if (!isStagingGitPolicyContext(input.platform, policyContext)) {
    return brain;
  }

  if (!providersAllowStagingValidate(input)) {
    return brain;
  }

  const minScore = OPERATION_MIN_SCORE["release.validate"];

  if (input.dryRun) {
    if (brain.score < minScore) {
      return brain;
    }

    return {
      ...brain,
      verdict: "caution",
      rejected: false,
      shouldBlock: false,
      recommendation: `Staging validate (dryRun) para ${input.platform.name}: providers OK (score ${String(brain.score)}) — ejecutar validate sin dryRun para auditar Vercel`,
      reasoning: [
        ...brain.reasoning,
        "Política staging: rama permitida en catalog — warnings de rama/upstream no bloquean",
        "dryRun: Brain no bloquea; decisión formal GO requiere validación Vercel real",
      ],
    };
  }

  if (input.validationPassed !== true) {
    return brain;
  }

  return {
    ...brain,
    verdict: brain.score >= SCORE_THRESHOLDS.approve ? "approve" : "caution",
    rejected: false,
    shouldBlock: false,
    recommendation: `Staging validate para ${input.platform.name}: Vercel OK, providers OK (score ${String(brain.score)})`,
    reasoning: [
      ...brain.reasoning,
      "Política staging: env diffs preview/prod y warnings no bloquean validate real con Vercel passed",
    ],
  };
}

export function mergeBrainWithGitGate(
  brain: ReleaseBrainAssessment,
  gitReadiness: GitReleaseReadiness | null | undefined,
): ReleaseBrainAssessment {
  if (!gitReadiness) {
    return brain;
  }

  const gitBlocks = gitReadiness.blockers.length > 0 || gitReadiness.riskLevel === "high";

  if (!gitBlocks) {
    return brain;
  }

  return {
    ...brain,
    verdict: "reject",
    rejected: true,
    shouldBlock: true,
    reasoning: [
      ...brain.reasoning,
      `Git (${gitReadiness.riskLevel}): ${gitReadiness.recommendation}`,
      ...gitReadiness.blockers.map((blocker) => `Git blocker: ${blocker}`),
    ],
    recommendation:
      gitReadiness.blockers.length > 0
        ? `Git bloquea release: ${gitReadiness.blockers.join("; ")}`
        : gitReadiness.recommendation,
  };
}

export function mergeBrainWithPrismaGate(
  brain: ReleaseBrainAssessment,
  prismaReadiness: PrismaReleaseReadiness | null | undefined,
): ReleaseBrainAssessment {
  if (!prismaReadiness) {
    return brain;
  }

  if (!prismaHasCriticalBlockers(prismaReadiness)) {
    return brain;
  }

  return {
    ...brain,
    verdict: "reject",
    rejected: true,
    shouldBlock: true,
    reasoning: [
      ...brain.reasoning,
      `Prisma (${prismaReadiness.riskLevel}): ${prismaReadiness.recommendation}`,
      ...prismaReadiness.blockers.map((blocker) => `Prisma blocker: ${blocker}`),
    ],
    recommendation:
      prismaReadiness.blockers.length > 0
        ? `Prisma bloquea release: ${prismaReadiness.blockers.join("; ")}`
        : prismaReadiness.recommendation,
  };
}

export function mergeBrainWithPostgresGate(
  brain: ReleaseBrainAssessment,
  postgresReadiness: PostgresReleaseReadiness | null | undefined,
): ReleaseBrainAssessment {
  if (!postgresReadiness) {
    return brain;
  }

  if (!postgresHasCriticalBlockers(postgresReadiness)) {
    return brain;
  }

  const blockers = describePostgresBlockers(postgresReadiness);

  return {
    ...brain,
    verdict: "reject",
    rejected: true,
    shouldBlock: true,
    reasoning: [
      ...brain.reasoning,
      `PostgreSQL (${postgresReadiness.riskLevel}): ${postgresReadiness.recommendation}`,
      ...blockers.map((blocker) => `PostgreSQL blocker: ${blocker}`),
    ],
    recommendation: `PostgreSQL bloquea release: ${blockers.join("; ")}`,
  };
}

export function mergeBrainWithCloudflareGate(
  brain: ReleaseBrainAssessment,
  cloudflareReadiness: CloudflareReleaseReadiness | null | undefined,
): ReleaseBrainAssessment {
  if (!cloudflareReadiness) {
    return brain;
  }

  if (!cloudflareHasCriticalBlockers(cloudflareReadiness)) {
    return brain;
  }

  const blockers = describeCloudflareBlockers(cloudflareReadiness);

  return {
    ...brain,
    verdict: "reject",
    rejected: true,
    shouldBlock: true,
    reasoning: [
      ...brain.reasoning,
      `Cloudflare/R2 (${cloudflareReadiness.riskLevel}): ${cloudflareReadiness.recommendation}`,
      ...blockers.map((blocker) => `Cloudflare/R2 blocker (QA fotos): ${blocker}`),
    ],
    recommendation: `QA de fotos bloqueada por Cloudflare/R2: ${blockers.join("; ")}`,
  };
}

export function mergeBrainWithProviderGates(
  brain: ReleaseBrainAssessment,
  gitReadiness: GitReleaseReadiness | null | undefined,
  prismaReadiness: PrismaReleaseReadiness | null | undefined,
  postgresReadiness?: PostgresReleaseReadiness | null,
  cloudflareReadiness?: CloudflareReleaseReadiness | null,
): ReleaseBrainAssessment {
  return mergeBrainWithCloudflareGate(
    mergeBrainWithPostgresGate(
      mergeBrainWithPrismaGate(mergeBrainWithGitGate(brain, gitReadiness), prismaReadiness),
      postgresReadiness,
    ),
    cloudflareReadiness,
  );
}

function appendStatusSignals(
  status: StatusSnapshot | Record<string, unknown>,
  staging: StagingSnapshot | Record<string, unknown>,
  signals: BrainSignal[],
): void {
  if ((status as Record<string, unknown>).dryRun === true) {
    return;
  }

  const stagingData = staging as StagingSnapshot;
  const data = normalizeVercelStatusSnapshot(status, stagingData.project.name) as StatusSnapshot;
  if (!data.project) {
    return;
  }

  signals.push({
    source: "vercel_status",
    type: "health",
    key: "deployment.status",
    message: `Salud del proyecto: ${data.project.health}`,
    value: data.project.health === "healthy" ? "healthy" : data.project.health,
    ...(data.project.health === "failed" ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "vercel_status",
    type: "state",
    key: "project.available",
    message: `Proyecto ${data.project.name} disponible`,
    value: true,
  });
}

function appendStagingSignals(
  staging: StagingSnapshot | Record<string, unknown>,
  signals: BrainSignal[],
): void {
  if ((staging as Record<string, unknown>).dryRun === true) {
    return;
  }

  const data = staging as StagingSnapshot;

  signals.push({
    source: "vercel_prepare_staging",
    type: "checklist",
    key: "staging.ready",
    message: "Staging listo para validación",
    value: data.stagingReady,
  });

  signals.push({
    source: "vercel_prepare_staging",
    type: "state",
    key: "preview.available",
    message: "Deployment preview disponible",
    value: data.deployments.preview !== null && data.deployments.preview !== undefined,
  });

  signals.push({
    source: "vercel_prepare_staging",
    type: "metric",
    key: "staging.env.issues.count",
    message: "Diffs de entorno preview vs production (informativo)",
    value: data.environment.issues.length,
  });

  signals.push({
    source: "vercel_prepare_staging",
    type: "metric",
    key: "checklist.failed",
    message: "Items fallidos en checklist de staging",
    value: data.domains.diff.unverified.length,
  });
}

function appendValidationSignals(
  validation: Record<string, unknown> | undefined,
  validationDecision: ReleaseDecision | undefined,
  validationIssues: string[],
  signals: BrainSignal[],
): void {
  if (!validation) {
    return;
  }

  const passed = validation.passed === true;
  const issueCount = validationIssues.length;

  signals.push({
    source: "vercel_validate_staging",
    type: "state",
    key: "validation.passed",
    message: passed ? "Validación exitosa" : "Validación fallida",
    value: passed,
  });

  signals.push({
    source: "vercel_validate_staging",
    type: "metric",
    key: "validation.issues.count",
    message: "Issues críticos de validación",
    value: issueCount,
  });

  if (validationDecision) {
    signals.push({
      source: "vercel_validate_staging",
      type: "state",
      key: "validation.decision",
      message: `Decisión de validación: ${validationDecision}`,
      value: validationDecision,
    });
  }

  if (passed && validationDecision === "GO") {
    signals.push({
      source: "vercel_validate_staging",
      type: "state",
      key: "staging.validated",
      message: "Staging validado para producción",
      value: true,
    });
  }
}

function appendPolicySignals(platform: PlatformDefinition, signals: BrainSignal[]): void {
  signals.push({
    source: "platform-catalog",
    type: "policy",
    key: "maintenance.enabled",
    message: platform.maintenanceMode.enabled
      ? `Mantenimiento activo: ${platform.maintenanceMode.message ?? ""}`
      : "Sin modo mantenimiento",
    value: platform.maintenanceMode.enabled,
    ...(platform.maintenanceMode.enabled ? { severity: "critical" as const } : {}),
  });
}

function toBrainSeverity(level: ReleaseRisk["level"]): SignalSeverity {
  switch (level) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
  }
}
