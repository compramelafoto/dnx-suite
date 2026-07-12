import type {
  ChecklistItem,
  ExecuteReleaseResult,
  OrchestratorMetrics,
  PrepareReleaseResult,
  ReleaseDecision,
  ReleasePlan,
  ReleaseRisk,
  RollbackReleaseResult,
  ValidateReleaseResult,
} from "./release-types.js";
import type { ReleaseBrainAssessment } from "./release-brain.js";
import { formatGitReport } from "./release-git.js";
import { formatPrismaReport } from "./release-prisma.js";
import { formatPostgresReport } from "./release-postgres.js";
import { formatCloudflareReport } from "./release-cloudflare.js";
import { highestRiskLevel } from "./release-checklist.js";

export function buildReleasePlan(params: {
  platformId: string;
  platformName: string;
  vercelProject: string;
  risks: ReleaseRisk[];
  checklist: ChecklistItem[];
  readyForValidation: boolean;
}): ReleasePlan {
  return {
    platformId: params.platformId,
    platformName: params.platformName,
    vercelProject: params.vercelProject,
    candidateTarget: "production",
    steps: [
      "1. prepareRelease — status + staging audit",
      "2. validateRelease — GO/NO-GO",
      "3. executeRelease — deploy con confirm: true",
      "4. (opcional) rollbackRelease — si hay incidente",
    ],
    risks: params.risks,
    checklist: params.checklist,
    readyForValidation: params.readyForValidation,
    generatedAt: new Date().toISOString(),
  };
}

export function buildPrepareReport(result: PrepareReleaseResult): Record<string, unknown> {
  return {
    type: "prepare_release",
    platformId: result.platformId,
    platformName: result.platformName,
    vercelProject: result.vercelProject,
    dryRun: result.dryRun,
    phase: result.phase,
    riskLevel: highestRiskLevel(result.risks),
    riskCount: result.risks.length,
    checklistSummary: summarizeChecklist(result.checklist),
    readyForValidation: result.plan.readyForValidation,
    metrics: result.metrics,
    plan: result.plan,
    brain: formatBrainReport(result.brain),
    ...(result.git ? { git: formatGitReport(result.git) } : {}),
    ...(result.prisma ? { prisma: formatPrismaReport(result.prisma) } : {}),
    ...(result.postgres ? { postgres: formatPostgresReport(result.postgres) } : {}),
    ...(result.cloudflare ? { cloudflare: formatCloudflareReport(result.cloudflare) } : {}),
  };
}

export function buildValidateReport(
  result: ValidateReleaseResult,
  decision: ReleaseDecision,
): Record<string, unknown> {
  return {
    type: "validate_release",
    platformId: result.platformId,
    platformName: result.platformName,
    vercelProject: result.vercelProject,
    dryRun: result.dryRun,
    phase: result.phase,
    decision,
    issueCount: result.issues.length,
    issues: result.issues,
    validation: result.validation,
    metrics: result.metrics,
    brain: formatBrainReport(result.brain),
    ...(result.git ? { git: formatGitReport(result.git) } : {}),
    ...(result.prisma ? { prisma: formatPrismaReport(result.prisma) } : {}),
    ...(result.postgres ? { postgres: formatPostgresReport(result.postgres) } : {}),
    ...(result.cloudflare ? { cloudflare: formatCloudflareReport(result.cloudflare) } : {}),
    summary: buildValidateSummary(decision, result),
  };
}

export function buildExecuteReport(result: ExecuteReleaseResult): Record<string, unknown> {
  const deployment = result.deployment;
  const success = deployment?.success === true;

  return {
    type: "execute_release",
    platformId: result.platformId,
    platformName: result.platformName,
    vercelProject: result.vercelProject,
    dryRun: result.dryRun,
    executed: result.executed,
    phase: result.phase,
    success,
    deployment,
    metrics: result.metrics,
    ...(result.brain ? { brain: formatBrainReport(result.brain) } : {}),
    ...(result.git ? { git: formatGitReport(result.git) } : {}),
    ...(result.prisma ? { prisma: formatPrismaReport(result.prisma) } : {}),
    ...(result.postgres ? { postgres: formatPostgresReport(result.postgres) } : {}),
    ...(result.cloudflare ? { cloudflare: formatCloudflareReport(result.cloudflare) } : {}),
    summary: result.dryRun
      ? "Simulación de deploy completada"
      : success
        ? "Deploy ejecutado exitosamente"
        : "Deploy completado con advertencias",
  };
}

export function buildRollbackReport(result: RollbackReleaseResult): Record<string, unknown> {
  const success = result.report.success === true;

  return {
    type: "rollback_release",
    platformId: result.platformId,
    platformName: result.platformName,
    vercelProject: result.vercelProject,
    dryRun: result.dryRun,
    executed: result.executed,
    phase: result.phase,
    success,
    details: result.report,
    metrics: result.metrics,
    summary: result.dryRun
      ? "Simulación de rollback completada"
      : success
        ? "Rollback ejecutado exitosamente"
        : "Rollback completado con advertencias",
  };
}

export function createMetrics(): {
  steps: OrchestratorMetrics["steps"];
  start: () => void;
  record: (step: string, tool: OrchestratorMetrics["steps"][0]["tool"], dryRun: boolean) => void;
  finish: () => OrchestratorMetrics;
} {
  const steps: OrchestratorMetrics["steps"] = [];
  let startedAt = Date.now();
  let stepStartedAt = Date.now();

  return {
    steps,
    start() {
      startedAt = Date.now();
      stepStartedAt = Date.now();
    },
    record(step, tool, dryRun) {
      steps.push({
        step,
        tool,
        durationMs: Date.now() - stepStartedAt,
        success: true,
        dryRun,
      });
      stepStartedAt = Date.now();
    },
    finish() {
      return {
        totalDurationMs: Date.now() - startedAt,
        steps,
      };
    },
  };
}

function summarizeChecklist(checklist: ChecklistItem[]): Record<string, number> {
  return checklist.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, ready: 0, attention: 0, failed: 0 },
  );
}

function formatBrainReport(brain: ReleaseBrainAssessment): Record<string, unknown> {
  return {
    score: brain.score,
    confidence: brain.confidence,
    verdict: brain.verdict,
    shouldBlock: brain.shouldBlock,
    reasoning: brain.reasoning,
    recommendation: brain.recommendation,
    risks: brain.risks,
    inconsistencies: brain.inconsistencies,
    nextActions: brain.nextActions,
  };
}

function buildValidateSummary(decision: ReleaseDecision, result: ValidateReleaseResult): string {
  if (decision === "GO") {
    return `Release aprobado para ejecución (Brain score: ${String(result.brain.score)})`;
  }

  const reasons: string[] = [];
  if (result.brain.shouldBlock) {
    reasons.push("DNX Brain bloqueó la operación");
  }
  if (result.git && result.git.blockers.length > 0) {
    reasons.push(`${String(result.git.blockers.length)} bloqueo(s) Git`);
  }
  if (result.prisma && result.prisma.blockers.length > 0) {
    reasons.push(`${String(result.prisma.blockers.length)} bloqueo(s) Prisma`);
  }
  if (result.postgres && result.postgres.blockers.length > 0) {
    reasons.push(`${String(result.postgres.blockers.length)} bloqueo(s) PostgreSQL`);
  }
  if (
    result.cloudflare &&
    result.cloudflare.assetsRequired &&
    result.cloudflare.blockers.length > 0
  ) {
    reasons.push(
      `${String(result.cloudflare.blockers.length)} bloqueo(s) Cloudflare/R2 (QA fotos)`,
    );
  }
  if (result.postgres && !result.postgres.connected && result.postgres.blockers.length === 0) {
    reasons.push("PostgreSQL no conectado");
  }
  if (
    result.postgres &&
    !result.postgres.migrationTableExists &&
    result.postgres.blockers.length === 0
  ) {
    reasons.push("Tabla _prisma_migrations ausente");
  }
  if (result.issues.length > 0) {
    reasons.push(`${String(result.issues.length)} problema(s) de validación`);
  }

  return reasons.length > 0 ? `Release bloqueado — ${reasons.join(", ")}` : "Release bloqueado";
}
