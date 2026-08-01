import type { PlannerDecision } from "../agents/planner/schema.js";
import type { PlannerInput } from "../agents/planner/types.js";
import { createMockPlannerDecision } from "../agents/planner/mock.js";
import { buildStageEnvelope } from "../agents/planner/prompt-contract.js";
import type { ReviewDecision } from "../agents/reviewer/schema.js";
import type { ReviewerInput } from "../agents/reviewer/types.js";
import { createMockReviewDecision } from "../agents/reviewer/mock.js";

/**
 * Controllable mock autonomous scenarios for tests / local simulation.
 * Env: DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO
 */
export type MockAutonomousScenario =
  | "one-stage-complete"
  | "two-stage-complete"
  | "retry-then-complete"
  | "human-required"
  | "blocked"
  | "failed"
  | "budget" // handled by runner config, not sequence
  | "default";

const plannerCallCounts = new Map<string, number>();
const reviewerCallCounts = new Map<string, number>();

export function resetMockSequenceCounters(): void {
  plannerCallCounts.clear();
  reviewerCallCounts.clear();
}

export function resolveMockAutonomousScenario(
  env: NodeJS.ProcessEnv = process.env,
): MockAutonomousScenario {
  const raw = env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO?.trim().toLowerCase();
  switch (raw) {
    case "one-stage-complete":
    case "two-stage-complete":
    case "retry-then-complete":
    case "human-required":
    case "blocked":
    case "failed":
      return raw;
    default:
      return "default";
  }
}

function nextCount(map: Map<string, number>, key: string): number {
  const n = (map.get(key) ?? 0) + 1;
  map.set(key, n);
  return n;
}

function stagePlan(
  input: PlannerInput,
  stageNumber: number,
  title: string,
  objective: string,
): PlannerDecision {
  const envelope = buildStageEnvelope(stageNumber, title, input.task.project);
  const prompt = `${envelope}

Contexto:
Proyecto ${input.task.project}. Objetivo: ${input.task.objective}.

Objetivo:
${objective}

Alcance:
- Cambios locales en worktree aislado.
- No push/merge/deploy/production.

Acciones permitidas:
- READ_REPO
- EDIT_WORKTREE
- RUN_TESTS

Acciones prohibidas:
- PUSH, MERGE, DEPLOY_PRODUCTION, FORCE_PUSH, RESET_HARD

Preservar cambios ajenos:
No tocar trabajo preexistente no relacionado.

Validaciones requeridas:
- pnpm --filter @dnx/dev-orchestrator typecheck

Criterio de DONE:
- ${objective}

Salida obligatoria:
Resumen estructurado.

ACCIÓN LEGAL REQUERIDA: NO

NO comenzar automáticamente la siguiente etapa.

${envelope}`;

  return {
    decision: "CREATE_STAGE",
    reason: `Mock autonomous planner created stage ${stageNumber}`,
    stage: {
      stageNumber,
      title,
      objective,
      prompt,
      riskLevel: "LOW",
      estimatedComplexity: "LOW",
      requiresHumanApproval: false,
      allowedActions: ["READ_REPO", "EDIT_WORKTREE", "RUN_TESTS"],
      forbiddenActions: ["PUSH", "MERGE", "DEPLOY_PRODUCTION", "FORCE_PUSH", "RESET_HARD"],
      validationCommands: ["pnpm --filter @dnx/dev-orchestrator typecheck"],
      completionCriteria: [objective, "Sin modificar trabajo ajeno"],
      legalActionRequired: false,
      legalNotes: null,
    },
  };
}

export function createSequencedMockPlannerDecision(
  input: PlannerInput,
  scenario: MockAutonomousScenario = resolveMockAutonomousScenario(),
): PlannerDecision {
  const call = nextCount(plannerCallCounts, input.task.taskId);
  const nextStageNumber =
    input.existingStages.reduce((max, s) => Math.max(max, s.stageNumber), 0) + 1;

  if (scenario === "human-required" && call === 1) {
    return {
      decision: "HUMAN_REQUIRED",
      reason: "Mock autonomous scenario requires human approval.",
      stage: null,
    };
  }
  if (scenario === "blocked" && call === 1) {
    return {
      decision: "BLOCKED",
      reason: "Mock autonomous scenario blocked by safety.",
      stage: null,
    };
  }
  if (scenario === "failed" && call >= 2) {
    return {
      decision: "BLOCKED",
      reason: "Mock planner stopped after failure scenario.",
      stage: null,
    };
  }

  if (input.retryContext && (scenario === "retry-then-complete" || scenario === "default")) {
    return stagePlan(
      input,
      nextStageNumber,
      "CORRECCION TRAS RETRY",
      `Corregir: ${input.retryContext.summary}`,
    );
  }

  if (scenario === "two-stage-complete") {
    if (call === 1) {
      return stagePlan(input, 1, "IMPLEMENTACION BASE", "Implementar base incremental");
    }
    if (call === 2) {
      const rec = input.nextStageRecommendation;
      return stagePlan(
        input,
        2,
        rec?.title ?? "VALIDAR Y CERRAR",
        rec?.objective ?? "Validar y cerrar objetivo de task",
      );
    }
    return {
      decision: "COMPLETED",
      reason: "Mock planner: no further stages.",
      stage: null,
    };
  }

  if (scenario === "one-stage-complete" || scenario === "retry-then-complete") {
    if (call === 1 && !input.retryContext) {
      return stagePlan(input, nextStageNumber, "ETAPA UNICA", "Completar objetivo en una etapa");
    }
    if (input.retryContext) {
      return stagePlan(input, nextStageNumber, "RETRY CORRECTION", "Corregir issues del retry");
    }
    return {
      decision: "COMPLETED",
      reason: "Mock planner marks task complete — no pending work.",
      stage: null,
    };
  }

  // default: safe autonomous-friendly behavior
  if (input.nextStageRecommendation) {
    return stagePlan(
      input,
      nextStageNumber,
      input.nextStageRecommendation.title,
      input.nextStageRecommendation.objective,
    );
  }
  if (input.retryContext) {
    return stagePlan(input, nextStageNumber, "RETRY STAGE", input.retryContext.summary);
  }
  const completed = input.existingStages.filter((s) => s.status === "COMPLETED").length;
  if (completed > 0 && call > 1) {
    return {
      decision: "COMPLETED",
      reason: "Mock planner: existing completed stages; marking task COMPLETED.",
      stage: null,
    };
  }
  if (input.existingStages.some((s) => s.status === "PENDING")) {
    return {
      decision: "BLOCKED",
      reason: "Mock planner: pending stage already exists.",
      stage: null,
    };
  }
  return createMockPlannerDecision(input);
}

export function createSequencedMockReviewDecision(
  input: ReviewerInput,
  scenario: MockAutonomousScenario = resolveMockAutonomousScenario(),
): ReviewDecision {
  const call = nextCount(reviewerCallCounts, input.taskSummary.taskId);

  if (scenario === "failed" && call === 1) {
    return createMockReviewDecision(input, "failed");
  }
  if (scenario === "blocked") {
    return createMockReviewDecision(input, "blocked");
  }
  if (scenario === "human-required") {
    return createMockReviewDecision(input, "human-required");
  }
  if (scenario === "retry-then-complete") {
    if (call === 1) return createMockReviewDecision(input, "retry");
    return {
      ...createMockReviewDecision(input, "success"),
      decision: "STAGE_COMPLETED",
      taskDisposition: "TASK_COMPLETED",
      summary: "Mock reviewer: retry resolved; task completed.",
    };
  }
  if (scenario === "two-stage-complete") {
    if (call === 1) return createMockReviewDecision(input, "next-stage");
    return {
      ...createMockReviewDecision(input, "success"),
      decision: "STAGE_COMPLETED",
      taskDisposition: "TASK_COMPLETED",
      summary: "Mock reviewer: second stage done; task completed.",
      nextStageRecommendation: null,
    };
  }
  if (scenario === "one-stage-complete") {
    return {
      ...createMockReviewDecision(input, "success"),
      decision: "STAGE_COMPLETED",
      taskDisposition: "TASK_COMPLETED",
      summary: "Mock reviewer: one-stage task completed.",
    };
  }

  // default: first review asks next stage; second completes task
  if (call === 1) return createMockReviewDecision(input, "next-stage");
  return {
    ...createMockReviewDecision(input, "success"),
    decision: "STAGE_COMPLETED",
    taskDisposition: "TASK_COMPLETED",
    nextStageRecommendation: null,
    summary: "Mock reviewer: task completed.",
  };
}
