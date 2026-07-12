import type { ReleaseBrainAssessment } from "../../orchestrators/release/release-brain.js";
import type {
  ExecuteReleaseResult,
  PrepareReleaseResult,
  RollbackReleaseResult,
  ValidateReleaseResult,
} from "../../orchestrators/release/release-types.js";
import type { PlatformDefinition } from "../../platforms/types.js";

function formatBrain(brain: ReleaseBrainAssessment) {
  return {
    score: brain.score,
    confidence: brain.confidence,
    verdict: brain.verdict,
    shouldBlock: brain.shouldBlock,
    recommendation: brain.recommendation,
    reasoning: brain.reasoning,
    risks: brain.risks,
    nextActions: brain.nextActions,
    inconsistencies: brain.inconsistencies,
  };
}

function platformSummary(platform: PlatformDefinition) {
  return {
    id: platform.id,
    name: platform.name,
    vercelProject: platform.vercelProject,
    repository: platform.repository,
    defaultBranch: platform.defaultBranch,
  };
}

export function formatPrepareToolResponse(
  platform: PlatformDefinition,
  result: PrepareReleaseResult,
) {
  const blocked = result.brain.shouldBlock;

  return {
    success: true,
    dryRun: result.dryRun,
    phase: result.phase,
    platform: platformSummary(platform),
    plan: result.plan,
    risks: result.risks,
    checklist: result.checklist,
    readyForValidation: result.plan.readyForValidation,
    vercel: {
      status: result.status,
      staging: result.staging,
    },
    git: result.git,
    prisma: result.prisma,
    postgres: result.postgres,
    brain: formatBrain(result.brain),
    metrics: result.metrics,
    report: result.report,
    blocked,
    summary: blocked
      ? `Preparación completada con bloqueos — ${result.brain.recommendation}`
      : result.plan.readyForValidation
        ? "Plataforma lista para validateRelease"
        : "Preparación completada — revisar checklist antes de validar",
    message: result.dryRun
      ? "Simulación de prepareRelease completada (dryRun: true)"
      : "prepareRelease completado",
  };
}

export function formatValidateToolResponse(
  platform: PlatformDefinition,
  result: ValidateReleaseResult,
) {
  const blocked = result.brain.shouldBlock || result.decision === "NO-GO";

  return {
    success: true,
    dryRun: result.dryRun,
    phase: result.phase,
    platform: platformSummary(platform),
    decision: result.decision,
    blocked,
    canExecute: result.decision === "GO" && !result.brain.shouldBlock,
    issues: result.issues,
    validation: result.validation,
    git: result.git,
    prisma: result.prisma,
    postgres: result.postgres,
    brain: formatBrain(result.brain),
    metrics: result.metrics,
    report: result.report,
    summary:
      result.decision === "GO"
        ? `GO — release aprobado (Brain score: ${String(result.brain.score)})`
        : `NO-GO — release bloqueado${result.brain.shouldBlock ? " por DNX Brain" : ""}`,
    message: result.dryRun
      ? `Simulación de validateRelease: ${result.decision}`
      : `validateRelease: ${result.decision}`,
  };
}

export function formatExecuteToolResponse(
  platform: PlatformDefinition,
  result: ExecuteReleaseResult,
) {
  const deployment = result.deployment;
  const success = deployment?.success === true;

  return {
    success: result.executed ? success : true,
    dryRun: result.dryRun,
    executed: result.executed,
    phase: result.phase,
    platform: platformSummary(platform),
    deployment,
    git: result.git,
    prisma: result.prisma,
    postgres: result.postgres,
    brain: result.brain ? formatBrain(result.brain) : null,
    metrics: result.metrics,
    report: result.report,
    summary: result.dryRun
      ? "Simulación de executeRelease completada"
      : result.executed
        ? success
          ? "Deploy ejecutado exitosamente"
          : "Deploy completado con advertencias"
        : "executeRelease no ejecutó cambios",
    message: result.dryRun
      ? "Simulación de deploy completada (dryRun: true)"
      : result.executed
        ? "executeRelease ejecutado"
        : "executeRelease sin ejecución",
  };
}

export function formatExecuteSkippedResponse(
  platform: PlatformDefinition,
  input: { dryRun: boolean; confirm: boolean },
) {
  return {
    success: true,
    executed: false,
    dryRun: input.dryRun,
    confirmed: input.confirm,
    platform: platformSummary(platform),
    summary: "Ejecución omitida — confirmación requerida",
    message:
      "No se ejecutó el release. Usa dryRun: true para simular o confirm: true con dryRun: false para desplegar en producción.",
    hint: {
      simulate: { dryRun: true, confirm: false },
      execute: { dryRun: false, confirm: true },
    },
  };
}

export function formatRollbackToolResponse(
  platform: PlatformDefinition,
  result: RollbackReleaseResult,
) {
  const success = result.report.success === true;

  return {
    success: result.executed ? success : true,
    dryRun: result.dryRun,
    executed: result.executed,
    phase: result.phase,
    platform: platformSummary(platform),
    details: result.report,
    metrics: result.metrics,
    report: result.report,
    summary: result.dryRun
      ? "Simulación de rollback completada"
      : result.executed
        ? success
          ? "Rollback ejecutado exitosamente"
          : "Rollback completado con advertencias"
        : "rollbackRelease sin ejecución",
    message: result.dryRun
      ? "Simulación de rollback completada (dryRun: true)"
      : result.executed
        ? "rollbackRelease ejecutado"
        : "rollbackRelease sin ejecución",
  };
}

export function formatRollbackSkippedResponse(
  platform: PlatformDefinition,
  input: { dryRun: boolean; confirm: boolean },
) {
  return {
    success: true,
    executed: false,
    dryRun: input.dryRun,
    confirmed: input.confirm,
    platform: platformSummary(platform),
    summary: "Rollback omitido — confirmación requerida",
    message:
      "No se ejecutó el rollback. Usa dryRun: true para simular o confirm: true con dryRun: false para revertir en producción.",
    hint: {
      simulate: { dryRun: true, confirm: false },
      execute: { dryRun: false, confirm: true },
    },
  };
}
