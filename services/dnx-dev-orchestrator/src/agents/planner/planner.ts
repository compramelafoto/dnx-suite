import { canContinueTask } from "../../budget/budget.js";
import type { OrchConfig } from "../../config/env.js";
import { createLogger } from "../../logging/logger.js";
import { JsonTaskStore } from "../../state/store.js";
import type { Task } from "../../state/types.js";
import {
  createSequencedMockPlannerDecision,
  resolveMockAutonomousScenario,
} from "../../runtime/mock-sequences.js";
import { createMockPlannerDecision, mockPlannerUsage } from "./mock.js";
import { runOpenAiPlanner } from "./openai-provider.js";
import { safetyPolicySummaryLines } from "./safety-gate.js";
import type { PlannerDecision } from "./schema.js";
import type { PlanCommandResult, PlannerInput, PlanningRun, StageSummary } from "./types.js";
import { estimateCostUsd, emptyUsage } from "./usage.js";
import { validatePlannerDecision } from "./validate.js";

const log = createLogger("planner");

export type PlanOptions = {
  dryRun?: boolean;
  /** Injected planner for tests. */
  plannerFn?: (input: PlannerInput) => Promise<{ decision: PlannerDecision; usage: PlanningRun["usage"] }>;
};

function toStageSummaries(task: Task): StageSummary[] {
  return task.stages.map((stage) => ({
    stageId: stage.stageId,
    stageNumber: stage.stageNumber,
    title: stage.title,
    status: stage.status,
    hasPrompt: Boolean(stage.prompt),
    costUsd: stage.costUsd,
  }));
}

export function buildPlannerInput(
  task: Task,
  budget: ReturnType<typeof canContinueTask>,
  extras: {
    lastReviewSummary?: PlannerInput["lastReviewSummary"];
  } = {},
): PlannerInput {
  return {
    task: {
      taskId: task.taskId,
      project: task.project,
      objective: task.objective,
      status: task.status,
      currentStage: task.currentStage,
      iteration: task.iteration,
      maxIterations: task.maxIterations,
      budgetUsd: task.budgetUsd,
      spentUsd: task.spentUsd,
    },
    existingStages: toStageSummaries(task),
    safetyPolicySummary: safetyPolicySummaryLines(),
    budgetStatus: budget,
    retryContext: task.retryContext ?? null,
    nextStageRecommendation: task.nextStageRecommendation ?? null,
    lastReviewSummary: extras.lastReviewSummary ?? null,
    repositoryContext: {
      repoName: "dnx-suite",
      note: "Minimal context only. Do not assume full repo contents. Prefer incremental audit stages when unsure.",
    },
  };
}

/** Exported for unit tests of retry limits. */
export async function invokePlanner(
  input: PlannerInput,
  config: OrchConfig,
  plannerFn?: PlanOptions["plannerFn"],
): Promise<{ decision: PlannerDecision; usage: PlanningRun["usage"]; attempts: number; error?: string }> {
  if (plannerFn) {
    const result = await plannerFn(input);
    return { ...result, attempts: 1 };
  }

  if (config.plannerProvider === "mock") {
    const scenario = resolveMockAutonomousScenario();
    // Prefer sequenced mock whenever autonomous scenario is set or context carries retry/recommendation.
    const useSequenced =
      scenario !== "default" ||
      Boolean(input.retryContext) ||
      Boolean(input.nextStageRecommendation) ||
      input.existingStages.some((s) => s.status === "COMPLETED");
    const decision = useSequenced
      ? createSequencedMockPlannerDecision(input, scenario)
      : createMockPlannerDecision(input);
    return {
      decision,
      usage: mockPlannerUsage(),
      attempts: 1,
    };
  }

  if (!config.openaiConfigured) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }

  let lastError = "unknown";
  const maxAttempts = config.maxPlannerRetries + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runOpenAiPlanner(input, config.openaiModel);
      const validated = validatePlannerDecision(result.decision);
      if (validated.ok) {
        return { decision: validated.decision, usage: result.usage, attempts: attempt };
      }
      if (validated.code === "HUMAN_REQUIRED" || validated.code === "SAFETY_BLOCKED") {
        return {
          decision: {
            decision: validated.code === "HUMAN_REQUIRED" ? "HUMAN_REQUIRED" : "BLOCKED",
            reason: validated.reason,
            stage: null,
          },
          usage: result.usage,
          attempts: attempt,
        };
      }
      lastError = validated.reason;
      log.warn("planner_retry", `Validation failed on attempt ${attempt}`, {
        metadata: { code: validated.code, reason: validated.reason },
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError.includes("OPENAI_NOT_CONFIGURED")) throw error;
      log.warn("planner_retry", `Provider error on attempt ${attempt}`, {
        metadata: { reason: lastError },
      });
    }
  }

  throw new Error(`PLANNER_RETRIES_EXHAUSTED: ${lastError}`);
}

export async function planTask(
  store: JsonTaskStore,
  config: OrchConfig,
  taskId: string,
  options: PlanOptions = {},
): Promise<PlanCommandResult> {
  const dryRun = Boolean(options.dryRun);
  const task = await store.getTask(taskId);
  if (!task) {
    return {
      ok: false,
      code: "TASK_NOT_FOUND",
      message: `Task not found: ${taskId}`,
      planningRun: null,
      decision: null,
      task: null,
      stage: null,
    };
  }

  const budget = canContinueTask({
    taskBudgetUsd: task.budgetUsd,
    spentUsd: task.spentUsd,
    dailyBudgetUsd: config.dailyBudgetUsd,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    dailySpentUsd: task.spentUsd,
    monthlySpentUsd: task.spentUsd,
    iterations: task.iteration,
    maxIterations: task.maxIterations,
  });

  if (!budget.allowed) {
    return {
      ok: false,
      code: "BUDGET_EXCEEDED",
      message: budget.reason,
      planningRun: null,
      decision: null,
      task,
      stage: null,
    };
  }

  if (config.plannerProvider === "openai" && !config.openaiConfigured && !options.plannerFn) {
    return {
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      message: "OPENAI_NOT_CONFIGURED. Set OPENAI_API_KEY or use DNX_ORCH_PLANNER_PROVIDER=mock.",
      planningRun: null,
      decision: null,
      task,
      stage: null,
    };
  }

  const input = buildPlannerInput(task, budget);

  let decision: PlannerDecision;
  let usage = emptyUsage();
  let attempts = 1;

  try {
    const invoked = await invokePlanner(input, config, options.plannerFn);
    decision = invoked.decision;
    usage = invoked.usage;
    attempts = invoked.attempts;

    // Validate again for mock/injected paths.
    const validated = validatePlannerDecision(decision);
    if (!validated.ok) {
      if (validated.code === "HUMAN_REQUIRED" || validated.code === "SAFETY_BLOCKED") {
        decision = {
          decision: validated.code === "HUMAN_REQUIRED" ? "HUMAN_REQUIRED" : "BLOCKED",
          reason: validated.reason,
          stage: null,
        };
      } else {
        throw new Error(validated.reason);
      }
    } else {
      decision = validated.decision;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("OPENAI_NOT_CONFIGURED")) {
      return {
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        message: "OPENAI_NOT_CONFIGURED",
        planningRun: null,
        decision: null,
        task,
        stage: null,
      };
    }

    const planningRun: PlanningRun = {
      planningRunId: "pending",
      taskId: task.taskId,
      createdAt: new Date().toISOString(),
      model: config.openaiModel,
      provider: config.plannerProvider,
      decision: "BLOCKED",
      reason: message,
      usage,
      costUsd: estimateCostUsd(usage),
      status: "BLOCKED",
      error: message,
      stagePlan: null,
      dryRun,
      attempts,
    };

    if (!dryRun) {
      const saved = await store.savePlanningRun({
        ...planningRun,
        planningRunId: undefined,
      });
      planningRun.planningRunId = saved.planningRunId;
      await store.updateTask(task.taskId, {
        status: "BLOCKED",
        lastError: message,
        lastPlanningRunId: saved.planningRunId,
        iteration: task.iteration + 1,
      });
    }

    return {
      ok: false,
      code: "BLOCKED",
      message,
      planningRun,
      decision: null,
      task: dryRun ? task : await store.getTask(task.taskId),
      stage: null,
    };
  }

  // Duplicate pending stage guard
  if (
    (decision.decision === "CREATE_STAGE" || decision.decision === "RETRY_STAGE") &&
    decision.stage
  ) {
    const pending = store.findPendingStage(task, decision.stage.stageNumber);
    if (pending && decision.decision === "CREATE_STAGE") {
      const planningRun: PlanningRun = {
        planningRunId: "pending",
        taskId: task.taskId,
        createdAt: new Date().toISOString(),
        model: config.openaiModel,
        provider: config.plannerProvider,
        decision: decision.decision,
        reason: "STAGE_ALREADY_EXISTS",
        usage,
        costUsd: estimateCostUsd(usage),
        status: "STAGE_ALREADY_EXISTS",
        stagePlan: decision.stage,
        dryRun,
        attempts,
      };
      if (!dryRun) {
        const saved = await store.savePlanningRun({ ...planningRun, planningRunId: undefined });
        planningRun.planningRunId = saved.planningRunId;
      }
      return {
        ok: false,
        code: "STAGE_ALREADY_EXISTS",
        message: `STAGE_ALREADY_EXISTS for stageNumber=${decision.stage.stageNumber}`,
        planningRun,
        decision,
        task,
        stage: pending,
      };
    }
  }

  const planningRun: PlanningRun = {
    planningRunId: "pending",
    taskId: task.taskId,
    createdAt: new Date().toISOString(),
    model: config.openaiModel,
    provider: config.plannerProvider,
    decision: decision.decision,
    reason: decision.reason,
    usage,
    costUsd: estimateCostUsd(usage),
    status: dryRun ? "DRY_RUN" : "SUCCEEDED",
    stagePlan: decision.stage,
    dryRun,
    attempts,
  };

  if (dryRun) {
    return {
      ok: true,
      code: "DRY_RUN",
      message: "Dry-run planning completed. No task/stage persistence.",
      planningRun,
      decision,
      task,
      stage: null,
    };
  }

  const savedRun = await store.savePlanningRun({
    ...planningRun,
    planningRunId: undefined,
  });
  planningRun.planningRunId = savedRun.planningRunId;

  let nextTask = await store.updateTask(task.taskId, {
    lastPlanningRunId: savedRun.planningRunId,
    iteration: task.iteration + 1,
    lastError: null,
  });
  let stage = null;

  if (decision.decision === "CREATE_STAGE" && decision.stage) {
    const created = await store.createStage({
      taskId: task.taskId,
      title: decision.stage.title,
      prompt: decision.stage.prompt,
      stageNumber: decision.stage.stageNumber,
      planningRunId: savedRun.planningRunId,
      plan: decision.stage,
      status: "PENDING",
    });
    if ("duplicate" in created && created.duplicate) {
      return {
        ok: false,
        code: "STAGE_ALREADY_EXISTS",
        message: "STAGE_ALREADY_EXISTS",
        planningRun,
        decision,
        task: created.task,
        stage: created.stage,
      };
    }
    stage = created.stage;
    nextTask = await store.updateTask(task.taskId, {
      status: "READY",
      currentStage: decision.stage.stageNumber,
      lastPlanningRunId: savedRun.planningRunId,
    });
  } else if (decision.decision === "RETRY_STAGE" && decision.stage) {
    const existing = task.stages.find((s) => s.stageNumber === decision.stage?.stageNumber);
    if (existing) {
      stage = await store.updateStage(task.taskId, existing.stageId, {
        title: decision.stage.title,
        prompt: decision.stage.prompt,
        plan: decision.stage,
        planningRunId: savedRun.planningRunId,
        status: "PENDING",
      });
      nextTask = await store.updateTask(task.taskId, {
        status: "READY",
        currentStage: decision.stage.stageNumber,
        lastPlanningRunId: savedRun.planningRunId,
      });
    } else {
      const created = await store.createStage({
        taskId: task.taskId,
        title: decision.stage.title,
        prompt: decision.stage.prompt,
        stageNumber: decision.stage.stageNumber,
        planningRunId: savedRun.planningRunId,
        plan: decision.stage,
        status: "PENDING",
      });
      if (!("duplicate" in created)) {
        stage = created.stage;
        nextTask = created.task;
      }
      nextTask = await store.updateTask(task.taskId, {
        status: "READY",
        lastPlanningRunId: savedRun.planningRunId,
      });
    }
  } else if (decision.decision === "HUMAN_REQUIRED") {
    nextTask = await store.updateTask(task.taskId, {
      status: "HUMAN_REQUIRED",
      lastError: decision.reason,
      lastPlanningRunId: savedRun.planningRunId,
    });
  } else if (decision.decision === "BLOCKED") {
    nextTask = await store.updateTask(task.taskId, {
      status: "BLOCKED",
      lastError: decision.reason,
      lastPlanningRunId: savedRun.planningRunId,
    });
  } else if (decision.decision === "COMPLETED") {
    nextTask = await store.updateTask(task.taskId, {
      status: "COMPLETED",
      lastPlanningRunId: savedRun.planningRunId,
    });
  }

  const code =
    decision.decision === "CREATE_STAGE" || decision.decision === "RETRY_STAGE"
      ? "PLANNED"
      : decision.decision === "COMPLETED"
        ? "COMPLETED"
        : decision.decision === "HUMAN_REQUIRED"
          ? "HUMAN_REQUIRED"
          : "BLOCKED";

  log.info("plan_complete", `Planner decision ${decision.decision}`, {
    taskId: task.taskId,
    metadata: {
      decision: decision.decision,
      provider: config.plannerProvider,
      dryRun,
      attempts,
    },
  });

  return {
    ok: code === "PLANNED" || code === "COMPLETED",
    code,
    message: decision.reason,
    planningRun,
    decision,
    task: nextTask,
    stage,
  };
}
