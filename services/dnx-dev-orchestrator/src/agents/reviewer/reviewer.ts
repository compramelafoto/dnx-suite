import { canContinueTask } from "../../budget/budget.js";
import type { OrchConfig } from "../../config/env.js";
import { createLogger } from "../../logging/logger.js";
import { JsonTaskStore } from "../../state/store.js";
import type { ReviewRunRecord, StageStatus, TaskStatus } from "../../state/types.js";
import { emptyUsage, estimateCostUsd } from "../planner/usage.js";
import type { OpenAiUsage } from "../planner/types.js";
import { buildReviewerInput, compactReviewerInput } from "./input.js";
import {
  createSequencedMockReviewDecision,
  resolveMockAutonomousScenario,
} from "../../runtime/mock-sequences.js";
import { createMockReviewDecision, mockReviewerUsage } from "./mock.js";
import { runOpenAiReviewer } from "./openai-provider.js";
import { applySafetyOverride, detectCursorSafetyViolations } from "./safety-gate.js";
import type { ReviewDecision } from "./schema.js";
import type { ReviewCommandResult, ReviewerInput } from "./types.js";
import { validateReviewDecision } from "./validate.js";

const log = createLogger("reviewer");

const REVIEWABLE_CURSOR_STATUSES = new Set(["COMPLETED", "FAILED", "TIMED_OUT", "BLOCKED"]);

export type ReviewOptions = {
  dryRun?: boolean;
  /** Injected reviewer for tests. */
  reviewerFn?: (input: ReviewerInput) => Promise<{ decision: ReviewDecision; usage: OpenAiUsage }>;
};

export async function invokeReviewer(
  input: ReviewerInput,
  config: OrchConfig,
  reviewerFn?: ReviewOptions["reviewerFn"],
): Promise<{ decision: ReviewDecision; usage: OpenAiUsage; attempts: number; error?: string }> {
  if (reviewerFn) {
    const result = await reviewerFn(input);
    return { ...result, attempts: 1 };
  }

  if (config.reviewerProvider === "mock") {
    const scenario = resolveMockAutonomousScenario();
    return {
      decision:
        scenario === "default"
          ? createMockReviewDecision(input)
          : createSequencedMockReviewDecision(input, scenario),
      usage: mockReviewerUsage(),
      attempts: 1,
    };
  }

  if (!config.openaiConfigured) {
    throw new Error("OPENAI_NOT_CONFIGURED");
  }

  let lastError = "unknown";
  const maxAttempts = config.maxReviewerRetries + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runOpenAiReviewer(input, config.openaiModel);
      const validated = validateReviewDecision(result.decision);
      if (validated.ok) {
        return { decision: validated.decision, usage: result.usage, attempts: attempt };
      }
      lastError = validated.reason;
      log.warn("reviewer_retry", `Validation failed on attempt ${attempt}`, {
        metadata: { code: validated.code, reason: validated.reason },
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (lastError.includes("OPENAI_NOT_CONFIGURED")) throw error;
      log.warn("reviewer_retry", `Provider error on attempt ${attempt}`, {
        metadata: { reason: lastError },
      });
    }
  }

  throw new Error(`REVIEWER_RETRIES_EXHAUSTED: ${lastError}`);
}

function applyStateTransition(
  decision: ReviewDecision,
): { stageStatus: StageStatus; taskStatus: TaskStatus; markTaskCompleted: boolean } {
  switch (decision.decision) {
    case "STAGE_COMPLETED":
      return {
        stageStatus: "COMPLETED",
        taskStatus: decision.taskDisposition === "TASK_COMPLETED" ? "COMPLETED" : "READY",
        markTaskCompleted: decision.taskDisposition === "TASK_COMPLETED",
      };
    case "CREATE_NEXT_STAGE":
      return {
        stageStatus: "COMPLETED",
        taskStatus: "READY",
        markTaskCompleted: false,
      };
    case "RETRY_STAGE":
      return {
        stageStatus: "RETRY_REQUIRED",
        taskStatus: "READY",
        markTaskCompleted: false,
      };
    case "HUMAN_REQUIRED":
      return {
        stageStatus: "HUMAN_REQUIRED",
        taskStatus: "HUMAN_REQUIRED",
        markTaskCompleted: false,
      };
    case "BLOCKED":
      return {
        stageStatus: "BLOCKED",
        taskStatus: "BLOCKED",
        markTaskCompleted: false,
      };
    case "FAILED":
      return {
        stageStatus: "FAILED",
        taskStatus: "FAILED",
        markTaskCompleted: false,
      };
    default:
      return {
        stageStatus: "BLOCKED",
        taskStatus: "BLOCKED",
        markTaskCompleted: false,
      };
  }
}

export async function reviewStage(
  store: JsonTaskStore,
  config: OrchConfig,
  stageId: string,
  options: ReviewOptions = {},
): Promise<ReviewCommandResult> {
  const dryRun = Boolean(options.dryRun);
  const found = await store.findStage(stageId);
  if (!found) {
    return {
      ok: false,
      code: "STAGE_NOT_FOUND",
      message: `Stage not found: ${stageId}`,
      reviewRun: null,
      decision: null,
      task: null,
      stage: null,
    };
  }

  const { task, stage } = found;
  const cursorRunId = stage.latestCursorRunId ?? stage.cursorRunId ?? task.lastCursorRunId;
  if (!cursorRunId) {
    return {
      ok: false,
      code: "CURSOR_RUN_NOT_FOUND",
      message: "No CursorRun associated with this stage",
      reviewRun: null,
      decision: null,
      task,
      stage,
    };
  }

  const cursorRun = await store.getCursorRun(cursorRunId);
  if (!cursorRun) {
    return {
      ok: false,
      code: "CURSOR_RUN_NOT_FOUND",
      message: `CursorRun not found: ${cursorRunId}`,
      reviewRun: null,
      decision: null,
      task,
      stage,
    };
  }

  if (!REVIEWABLE_CURSOR_STATUSES.has(cursorRun.status)) {
    return {
      ok: false,
      code: "CURSOR_RUN_NOT_REVIEWABLE",
      message: `CursorRun status not reviewable: ${cursorRun.status}`,
      reviewRun: null,
      decision: null,
      task,
      stage,
    };
  }

  // Idempotency: completed review for same cursorRunId
  if (stage.latestReviewRunId && !dryRun) {
    const existing = await store.getReviewRun(stage.latestReviewRunId);
    if (
      existing &&
      existing.status === "COMPLETED" &&
      existing.cursorRunId === cursorRun.cursorRunId
    ) {
      return {
        ok: false,
        code: "REVIEW_ALREADY_EXISTS",
        message: `REVIEW_ALREADY_EXISTS reviewRunId=${existing.reviewRunId} cursorRunId=${cursorRun.cursorRunId}`,
        reviewRun: existing,
        decision: existing.decision
          ? {
              decision: existing.decision,
              summary: existing.summary ?? "",
              evidence: existing.evidence ?? [],
              missingEvidence: existing.missingEvidence ?? [],
              issues: existing.issues ?? [],
              retryRecommended: existing.decision === "RETRY_STAGE",
              nextStageRecommendation: existing.nextStageRecommendation ?? null,
              taskDisposition: existing.taskDisposition ?? "CONTINUE",
            }
          : null,
        task,
        stage,
      };
    }
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
      reviewRun: null,
      decision: null,
      task,
      stage,
    };
  }

  if (config.reviewerProvider === "openai" && !config.openaiConfigured && !options.reviewerFn) {
    return {
      ok: false,
      code: "OPENAI_NOT_CONFIGURED",
      message: "OPENAI_NOT_CONFIGURED. Set OPENAI_API_KEY or use DNX_ORCH_REVIEWER_PROVIDER=mock.",
      reviewRun: null,
      decision: null,
      task,
      stage,
    };
  }

  const input = compactReviewerInput(
    buildReviewerInput({
      task,
      stage,
      cursorRun,
      budget,
      maxResultChars: Math.min(12_000, config.maxCursorOutputChars),
      maxFilesChangedWarning: config.maxFilesChangedWarning,
    }),
  );

  let decision: ReviewDecision;
  let usage = emptyUsage();
  let attempts = 1;
  let safetyOverride: string | null = null;

  try {
    const invoked = await invokeReviewer(input, config, options.reviewerFn);
    decision = invoked.decision;
    usage = invoked.usage;
    attempts = invoked.attempts;

    const validated = validateReviewDecision(decision);
    if (!validated.ok) {
      throw new Error(`${validated.code}: ${validated.reason}`);
    }
    decision = validated.decision;

    const findings = detectCursorSafetyViolations(cursorRun);
    const overridden = applySafetyOverride(decision, findings);
    decision = overridden.decision;
    safetyOverride = overridden.override;

    // Re-validate after override (override constructs valid decisions).
    const afterOverride = validateReviewDecision(decision);
    if (!afterOverride.ok) {
      throw new Error(`SAFETY_OVERRIDE_INVALID: ${afterOverride.reason}`);
    }
    decision = afterOverride.decision;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("OPENAI_NOT_CONFIGURED")) {
      return {
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        message: "OPENAI_NOT_CONFIGURED",
        reviewRun: null,
        decision: null,
        task,
        stage,
      };
    }

    const reviewRun: ReviewRunRecord = {
      reviewRunId: "pending",
      taskId: task.taskId,
      stageId: stage.stageId,
      cursorRunId: cursorRun.cursorRunId,
      createdAt: new Date().toISOString(),
      model: config.openaiModel,
      provider: config.reviewerProvider,
      status: "FAILED",
      usage,
      costUsd: estimateCostUsd(usage),
      error: message,
      dryRun,
      attempts,
      safetyOverride,
    };

    if (!dryRun) {
      const saved = await store.saveReviewRun({ ...reviewRun, reviewRunId: undefined });
      reviewRun.reviewRunId = saved.reviewRunId;
      await store.updateTask(task.taskId, {
        status: "BLOCKED",
        lastError: message,
        lastReviewRunId: saved.reviewRunId,
        iteration: task.iteration + 1,
      });
      await store.updateStage(task.taskId, stage.stageId, {
        status: "BLOCKED",
        latestReviewRunId: saved.reviewRunId,
      });
    }

    return {
      ok: false,
      code: "FAILED",
      message,
      reviewRun,
      decision: null,
      task: dryRun ? task : await store.getTask(task.taskId),
      stage: dryRun ? stage : (await store.findStage(stage.stageId))?.stage ?? stage,
      usage,
    };
  }

  const reviewRun: ReviewRunRecord = {
    reviewRunId: "pending",
    taskId: task.taskId,
    stageId: stage.stageId,
    cursorRunId: cursorRun.cursorRunId,
    createdAt: new Date().toISOString(),
    model: config.openaiModel,
    provider: config.reviewerProvider,
    status: dryRun ? "COMPLETED" : "COMPLETED",
    decision: decision.decision,
    summary: decision.summary,
    evidence: decision.evidence,
    missingEvidence: decision.missingEvidence,
    issues: decision.issues,
    nextStageRecommendation: decision.nextStageRecommendation,
    taskDisposition: decision.taskDisposition,
    usage,
    costUsd: estimateCostUsd(usage),
    dryRun,
    attempts,
    safetyOverride,
  };

  if (dryRun) {
    return {
      ok: true,
      code: "DRY_RUN",
      message: "Dry-run review completed. No task/stage persistence.",
      reviewRun,
      decision,
      task,
      stage,
      usage,
    };
  }

  const savedRun = await store.saveReviewRun({
    ...reviewRun,
    reviewRunId: undefined,
  });
  reviewRun.reviewRunId = savedRun.reviewRunId;

  const transition = applyStateTransition(decision);

  const taskPatch: Parameters<JsonTaskStore["updateTask"]>[1] = {
    status: transition.taskStatus,
    lastReviewRunId: savedRun.reviewRunId,
    iteration: task.iteration + 1,
    lastError: null,
    nextStageRecommendation:
      decision.decision === "CREATE_NEXT_STAGE" ? decision.nextStageRecommendation : null,
    retryContext:
      decision.decision === "RETRY_STAGE"
        ? {
            issues: decision.issues,
            missingEvidence: decision.missingEvidence,
            cursorRunId: cursorRun.cursorRunId,
            reviewRunId: savedRun.reviewRunId,
            summary: decision.summary,
          }
        : null,
  };

  if (transition.markTaskCompleted) {
    taskPatch.status = "COMPLETED";
  }

  const nextTask = await store.updateTask(task.taskId, taskPatch);
  const nextStage = await store.updateStage(task.taskId, stage.stageId, {
    status: transition.stageStatus,
    latestReviewRunId: savedRun.reviewRunId,
    finishedAt:
      transition.stageStatus === "COMPLETED" ||
      transition.stageStatus === "FAILED" ||
      transition.stageStatus === "BLOCKED" ||
      transition.stageStatus === "HUMAN_REQUIRED"
        ? new Date().toISOString()
        : stage.finishedAt,
  });

  const code =
    decision.decision === "STAGE_COMPLETED"
      ? "STAGE_COMPLETED"
      : decision.decision === "RETRY_STAGE"
        ? "RETRY_STAGE"
        : decision.decision === "CREATE_NEXT_STAGE"
          ? "CREATE_NEXT_STAGE"
          : decision.decision === "HUMAN_REQUIRED"
            ? "HUMAN_REQUIRED"
            : decision.decision === "BLOCKED"
              ? "BLOCKED"
              : "FAILED";

  log.info("review_complete", `Reviewer decision ${decision.decision}`, {
    taskId: task.taskId,
    metadata: {
      decision: decision.decision,
      provider: config.reviewerProvider,
      dryRun,
      attempts,
      safetyOverride,
    },
  });

  return {
    ok:
      code === "STAGE_COMPLETED" ||
      code === "CREATE_NEXT_STAGE" ||
      code === "RETRY_STAGE",
    code: code === "STAGE_COMPLETED" || code === "CREATE_NEXT_STAGE" || code === "RETRY_STAGE" || code === "HUMAN_REQUIRED" || code === "BLOCKED" || code === "FAILED"
      ? code
      : "REVIEWED",
    message: decision.summary,
    reviewRun,
    decision,
    task: nextTask,
    stage: nextStage,
    usage,
  };
}
