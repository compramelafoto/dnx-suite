import { planTask, type PlanOptions } from "../agents/planner/planner.js";
import { reviewStage, type ReviewOptions } from "../agents/reviewer/reviewer.js";
import { canContinueTask } from "../budget/budget.js";
import type { OrchConfig, AutonomyLevel } from "../config/env.js";
import { executeStage } from "../cursor/executor.js";
import { prepareTaskWorktree } from "../git/prepare-task.js";
import { gitOk } from "../git/exec.js";
import { createLogger } from "../logging/logger.js";
import { JsonTaskStore } from "../state/store.js";
import type {
  Task,
  TaskRunMode,
  TaskRunRecord,
  TaskRunStatus,
} from "../state/types.js";
import { runSafeValidations } from "../validation/runner.js";
import {
  buildProgressFingerprint,
  evaluatePostCursorGuards,
  type GuardFinding,
} from "./guards.js";
import { ExecutionLockManager } from "./lock.js";
import { TERMINAL_TASK_STATUSES, type StopReason } from "./stop-reasons.js";
import { resetMockSequenceCounters } from "./mock-sequences.js";

const log = createLogger("autonomous-runner");

export type AutonomousRunOptions = {
  confirmWrite?: boolean;
  prepare?: boolean;
  dryRun?: boolean;
  simulate?: boolean;
  verbose?: boolean;
  controlPlaneRoot: string;
  /** Injected for tests */
  plannerFn?: PlanOptions["plannerFn"];
  reviewerFn?: ReviewOptions["reviewerFn"];
  /** Skip real validation spawns in tests */
  skipValidationExec?: boolean;
  maxCycles?: number;
};

export type AutonomousRunResult = {
  ok: boolean;
  code: string;
  message: string;
  stopReason: StopReason | null;
  task: Task | null;
  taskRun: TaskRunRecord | null;
  eventsSummary: string[];
};

function isTerminalTaskStatus(status: string): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
}

function resolveMode(options: AutonomousRunOptions, config: OrchConfig): {
  mode: TaskRunMode;
  autonomyLevel: AutonomyLevel;
  writeAuthorized: boolean;
} {
  if (options.simulate || options.dryRun) {
    return { mode: "SIMULATE", autonomyLevel: "READ_ONLY", writeAuthorized: false };
  }
  const writeAuthorized = Boolean(options.confirmWrite) && config.allowWrite;
  if (writeAuthorized) {
    return { mode: "AUTONOMOUS_WRITE", autonomyLevel: "LOCAL_WRITE", writeAuthorized: true };
  }
  return { mode: "AUTONOMOUS_SAFE", autonomyLevel: "READ_ONLY", writeAuthorized: false };
}

function printLine(verbose: boolean, line: string, force = false): void {
  if (force || verbose) {
    console.log(line);
  } else {
    console.log(line);
  }
}

export class AutonomousTaskRunner {
  constructor(
    private readonly store: JsonTaskStore,
    private readonly config: OrchConfig,
  ) {}

  async run(taskId: string, options: AutonomousRunOptions): Promise<AutonomousRunResult> {
    if (process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO) {
      // Fresh counters per autonomous run in mock scenarios
      resetMockSequenceCounters();
    }

    const { mode, autonomyLevel, writeAuthorized } = resolveMode(options, this.config);
    const verbose = Boolean(options.verbose);
    const eventsSummary: string[] = [];

    const emit = async (
      runId: string,
      type: Parameters<JsonTaskStore["appendRunEvent"]>[0]["type"],
      message: string,
      extra?: { stageId?: string; metadata?: Record<string, unknown> },
    ) => {
      await this.store.appendRunEvent({
        runId,
        taskId,
        type,
        message,
        stageId: extra?.stageId,
        metadata: extra?.metadata,
      });
      eventsSummary.push(message);
      printLine(verbose, message, true);
    };

    let task = await this.store.getTask(taskId);
    if (!task) {
      return {
        ok: false,
        code: "TASK_NOT_FOUND",
        message: `Task not found: ${taskId}`,
        stopReason: null,
        task: null,
        taskRun: null,
        eventsSummary,
      };
    }

    if (task.status === "COMPLETED") {
      return {
        ok: true,
        code: "ALREADY_COMPLETED",
        message: "Task already COMPLETED",
        stopReason: "TASK_COMPLETED",
        task,
        taskRun: task.lastTaskRunId ? await this.store.getTaskRun(task.lastTaskRunId) : null,
        eventsSummary,
      };
    }
    if (isTerminalTaskStatus(task.status)) {
      return {
        ok: false,
        code: "TASK_TERMINAL",
        message: `Task is terminal: ${task.status}. Create a new task or clear cancel/block manually.`,
        stopReason: (task.stopReason as StopReason) ?? null,
        task,
        taskRun: task.lastTaskRunId ? await this.store.getTaskRun(task.lastTaskRunId) : null,
        eventsSummary,
      };
    }

    // Concurrency: only one active TaskRun
    const active = await this.store.findActiveTaskRun();
    if (active && active.taskId !== taskId && active.status === "RUNNING") {
      const alive = (() => {
        try {
          if (!active.pid) return false;
          process.kill(active.pid, 0);
          return true;
        } catch {
          return false;
        }
      })();
      if (alive) {
        return {
          ok: false,
          code: "CONCURRENCY_LIMIT_REACHED",
          message: `Active TaskRun ${active.runId} for task ${active.taskId}`,
          stopReason: "CONCURRENCY_LIMIT_REACHED",
          task,
          taskRun: active,
          eventsSummary,
        };
      }
      // Stale active run → mark recovery
      await this.store.updateTaskRun(active.runId, {
        status: "FAILED",
        stopReason: "RECOVERY_REQUIRED",
        error: "Stale RUNNING TaskRun with dead pid",
        finishedAt: new Date().toISOString(),
      });
    }

    // Crash recovery for this task
    const recovery = await this.recoverAmbiguousState(task);
    if (recovery.stop) {
      task = (await this.store.getTask(taskId))!;
      return {
        ok: false,
        code: recovery.code,
        message: recovery.message,
        stopReason: recovery.stopReason,
        task,
        taskRun: null,
        eventsSummary,
      };
    }
    task = (await this.store.getTask(taskId))!;

    if (task.cancelRequested) {
      task = await this.store.updateTask(taskId, {
        status: "CANCELLED",
        stopReason: "CANCELLED",
        cancelRequested: false,
      });
      return {
        ok: false,
        code: "CANCELLED",
        message: "Task cancel requested",
        stopReason: "CANCELLED",
        task,
        taskRun: null,
        eventsSummary,
      };
    }

    // Prepare worktree if needed
    if (!task.worktree) {
      if (options.prepare || mode === "AUTONOMOUS_WRITE" || mode === "AUTONOMOUS_SAFE") {
        const prepared = await prepareTaskWorktree(
          this.store,
          this.config,
          options.controlPlaneRoot,
          taskId,
        );
        if (!prepared.ok) {
          return {
            ok: false,
            code: prepared.code,
            message: prepared.message,
            stopReason: "FORBIDDEN_AUTOMATIC",
            task: prepared.task,
            taskRun: null,
            eventsSummary,
          };
        }
        task = prepared.task!;
      } else {
        return {
          ok: false,
          code: "WORKTREE_REQUIRED",
          message: "Task has no worktree. Pass --prepare or run task prepare first.",
          stopReason: null,
          task,
          taskRun: null,
          eventsSummary,
        };
      }
    }

    if (task.worktree === options.controlPlaneRoot) {
      return {
        ok: false,
        code: "FORBIDDEN_AUTOMATIC",
        message: "Refusing to run autonomy on control-plane working tree",
        stopReason: "FORBIDDEN_AUTOMATIC",
        task,
        taskRun: null,
        eventsSummary,
      };
    }

    if (options.dryRun || options.simulate) {
      await emit(
        "simulate",
        "INFO",
        `SIMULATE/DRY-RUN: would run autonomous loop mode=${mode} writeAuthorized=${writeAuthorized}`,
      );
      // Plan once in dry-run without persisting stage if dryRun on planner
      const planResult = await planTask(this.store, this.config, taskId, {
        dryRun: true,
        plannerFn: options.plannerFn,
      });
      return {
        ok: true,
        code: "SIMULATE",
        message: `Simulate complete. Planner would decide: ${planResult.decision?.decision ?? planResult.code}`,
        stopReason: null,
        task,
        taskRun: null,
        eventsSummary,
      };
    }

    const now = new Date().toISOString();
    let taskRun = await this.store.saveTaskRun({
      taskId,
      startedAt: now,
      mode,
      autonomyLevel,
      status: "RUNNING",
      iterations: 0,
      stageIterations: 0,
      plannerRuns: 0,
      cursorRuns: 0,
      reviewRuns: 0,
      validationRuns: 0,
      openaiTokensUsed: task.openaiTokensUsed ?? 0,
      noProgressCycles: 0,
      cancelRequested: false,
      pid: process.pid,
      heartbeatAt: now,
    });

    task = await this.store.updateTask(taskId, {
      status: "RUNNING",
      lastTaskRunId: taskRun.runId,
      stopReason: null,
    });

    printLine(verbose, "", true);
    printLine(verbose, "DNX DEV ORCHESTRATOR — AUTONOMOUS RUN", true);
    printLine(verbose, `Task: ${task.project} (${task.taskId})`, true);
    printLine(verbose, `Run: ${taskRun.runId}`, true);
    printLine(verbose, `Mode: ${mode} / ${autonomyLevel}`, true);
    printLine(verbose, "", true);

    await emit(taskRun.runId, "RUN_STARTED", `TASK RUN STARTED mode=${mode}`);

    const maxCycles = options.maxCycles ?? this.config.maxTaskIterations * 3;
    let stopReason: StopReason | null = null;
    let lastFingerprint: string | null = taskRun.lastFingerprint ?? null;
    let cycles = 0;

    try {
      for (cycles = 0; cycles < maxCycles; cycles += 1) {
        task = (await this.store.getTask(taskId))!;
        taskRun = await this.heartbeat(taskRun.runId);

        if (await this.isCancelRequested(taskId, taskRun.runId)) {
          stopReason = "CANCELLED";
          await this.finish(taskId, taskRun.runId, "CANCELLED", stopReason, "Cancelled by request");
          await emit(taskRun.runId, "CANCEL", "CANCELLED");
          break;
        }

        // Token budget
        const tokensUsed = task.openaiTokensUsed ?? 0;
        if (tokensUsed > this.config.maxOpenAiTokensPerTask) {
          stopReason = "BUDGET_EXCEEDED";
          await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, "OpenAI token budget exceeded");
          await emit(taskRun.runId, "ERROR", "BUDGET_EXCEEDED (tokens)");
          break;
        }

        const budget = canContinueTask({
          taskBudgetUsd: task.budgetUsd,
          spentUsd: task.spentUsd,
          dailyBudgetUsd: this.config.dailyBudgetUsd,
          monthlyBudgetUsd: this.config.monthlyBudgetUsd,
          dailySpentUsd: task.spentUsd,
          monthlySpentUsd: task.spentUsd,
          iterations: taskRun.iterations,
          maxIterations: this.config.maxTaskIterations,
        });
        if (!budget.allowed) {
          stopReason =
            budget.reason.includes("iterations") || budget.reason.includes("Max task")
              ? "TASK_ITERATION_LIMIT"
              : "BUDGET_EXCEEDED";
          await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, budget.reason);
          await emit(taskRun.runId, "ERROR", stopReason);
          break;
        }

        if (isTerminalTaskStatus(task.status) && task.status !== "RUNNING") {
          stopReason = (task.stopReason as StopReason) ?? "UNKNOWN_STATE";
          break;
        }

        const pendingStage = task.stages.find((s) => s.status === "PENDING");
        const validatingStage = task.stages.find((s) => s.status === "VALIDATING");
        const retryStage = task.stages.find((s) => s.status === "RETRY_REQUIRED");
        const needsPlan =
          !pendingStage &&
          !validatingStage &&
          (task.stages.length === 0 ||
            Boolean(task.nextStageRecommendation) ||
            Boolean(task.retryContext) ||
            retryStage ||
            task.status === "READY" ||
            task.status === "PLANNING" ||
            task.status === "RUNNING");

        // Prefer review when validating
        if (validatingStage) {
          printLine(verbose, `Iteration ${taskRun.iterations + 1}/${this.config.maxTaskIterations}`, true);
          printLine(verbose, "VALIDATION / REVIEWER", true);

          // Safe validations before review
          const cursorRunId = validatingStage.latestCursorRunId ?? validatingStage.cursorRunId;
          if (cursorRunId && task.worktree) {
            const val = await runSafeValidations({
              store: this.store,
              config: this.config,
              taskId,
              stageId: validatingStage.stageId,
              cursorRunId,
              workspace: task.worktree,
              proposedCommands: validatingStage.plan?.validationCommands ?? [],
              dryRun: options.skipValidationExec ?? this.config.cursorProvider === "mock",
            });
            taskRun = await this.store.updateTaskRun(taskRun.runId, {
              validationRuns: taskRun.validationRuns + val.runs.length,
            });
            await emit(
              taskRun.runId,
              "VALIDATION",
              `Validation runs=${val.runs.length} allPassed=${val.allPassed}`,
              { stageId: validatingStage.stageId },
            );

            // Diff/scope guards
            const cursorRun = await this.store.getCursorRun(cursorRunId);
            if (cursorRun) {
              const allFiles = await this.collectTaskFilesChanged(taskId);
              let numstat = "";
              try {
                numstat = await gitOk(["diff", "--numstat"], { cwd: task.worktree });
              } catch {
                numstat = cursorRun.gitDiffStat ?? "";
              }
              const findings = evaluatePostCursorGuards({
                config: this.config,
                task,
                stage: validatingStage,
                cursorRun,
                allTaskFilesChanged: allFiles,
                numstatText: numstat,
              });
              const hard = findings.find((f) => f.severity === "BLOCKED");
              const human = findings.find((f) => f.severity === "HUMAN_REQUIRED");
              if (hard || human) {
                const finding = (hard ?? human)!;
                stopReason = hard ? "SAFETY_BLOCK" : finding.code.startsWith("SCOPE")
                  ? "SCOPE_EXPANSION_HUMAN_REQUIRED"
                  : "DIFF_SIZE_HUMAN_REQUIRED";
                await this.store.saveApprovalRequest({
                  taskId,
                  stageId: validatingStage.stageId,
                  runId: taskRun.runId,
                  action: finding.code,
                  reason: finding.message,
                  riskLevel: hard ? "CRITICAL" : "HIGH",
                  status: "PENDING",
                });
                await this.finish(
                  taskId,
                  taskRun.runId,
                  hard ? "BLOCKED" : "HUMAN_REQUIRED",
                  stopReason,
                  finding.message,
                );
                await emit(taskRun.runId, "GUARD", `${stopReason}: ${finding.message}`, {
                  stageId: validatingStage.stageId,
                });
                this.printHumanGate(finding);
                break;
              }
            }
          }

          const review = await reviewStage(this.store, this.config, validatingStage.stageId, {
            reviewerFn: options.reviewerFn,
          });
          taskRun = await this.store.updateTaskRun(taskRun.runId, {
            reviewRuns: taskRun.reviewRuns + 1,
            iterations: taskRun.iterations + 1,
            lastReviewRunId: review.reviewRun?.reviewRunId ?? null,
            openaiTokensUsed:
              taskRun.openaiTokensUsed + (review.usage?.totalTokens ?? 0),
          });
          if (review.usage?.totalTokens) {
            task = await this.store.updateTask(taskId, {
              openaiTokensUsed: (task.openaiTokensUsed ?? 0) + (review.usage.totalTokens ?? 0),
            });
          }

          await emit(
            taskRun.runId,
            "REVIEWER",
            `REVIEW → ${review.decision?.decision ?? review.code}`,
            { stageId: validatingStage.stageId },
          );
          printLine(verbose, `✓ ${review.decision?.decision ?? review.code}`, true);

          const fp = buildProgressFingerprint({
            decision: review.decision?.decision,
            title: validatingStage.title,
            objective: validatingStage.plan?.objective,
            issues: review.decision?.issues.map((i) => i.code) ?? [],
            filesChanged: [],
          });
          const progress = await this.trackProgress(taskRun, fp, lastFingerprint);
          lastFingerprint = fp;
          taskRun = progress.taskRun;
          if (progress.stopped) {
            stopReason = "NO_PROGRESS_DETECTED";
            await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, "No progress detected");
            await emit(taskRun.runId, "ERROR", "NO_PROGRESS_DETECTED");
            break;
          }

          const handled = await this.handleReviewDecision(
            taskId,
            taskRun.runId,
            review,
            emit,
          );
          stopReason = handled.stopReason;
          if (handled.stop) break;
          continue;
        }

        // Execute pending stage
        if (pendingStage) {
          // Autonomy never silently degrades write stages to READ_ONLY.
          if (!writeAuthorized) {
            stopReason = "WRITE_AUTHORIZATION_REQUIRED";
            await this.finish(
              taskId,
              taskRun.runId,
              "HUMAN_REQUIRED",
              stopReason,
              "WRITE_AUTHORIZATION_REQUIRED: set DNX_ORCH_ALLOW_WRITE=true and pass --confirm-write",
            );
            await emit(taskRun.runId, "ERROR", "WRITE_AUTHORIZATION_REQUIRED");
            printLine(verbose, "WRITE_AUTHORIZATION_REQUIRED", true);
            break;
          }

          printLine(verbose, `Iteration ${taskRun.iterations + 1}/${this.config.maxTaskIterations}`, true);
          printLine(verbose, "CURSOR", true);
          const executed = await executeStage(this.store, this.config, pendingStage.stageId, {
            mode: "WRITE_LIMITED",
            confirmWrite: true,
            controlPlaneRoot: options.controlPlaneRoot,
            skipAuthCheck: this.config.cursorProvider === "mock",
          });
          taskRun = await this.store.updateTaskRun(taskRun.runId, {
            cursorRuns: taskRun.cursorRuns + 1,
            lastCursorRunId: executed.cursorRun?.cursorRunId ?? null,
            lastStageId: pendingStage.stageId,
            stageIterations: taskRun.stageIterations + 1,
          });
          await emit(
            taskRun.runId,
            "CURSOR",
            `CURSOR ${executed.code} files=${(executed.cursorRun?.filesChanged ?? []).length}`,
            { stageId: pendingStage.stageId },
          );
          printLine(
            verbose,
            executed.ok
              ? `✓ Completed technically  Files changed: ${(executed.cursorRun?.filesChanged ?? []).length}`
              : `✗ ${executed.code}`,
            true,
          );

          if (!executed.ok) {
            stopReason =
              executed.code === "FORBIDDEN_AUTOMATIC"
                ? "SAFETY_BLOCK"
                : executed.code === "WRITE_NOT_AUTHORIZED"
                  ? "WRITE_AUTHORIZATION_REQUIRED"
                  : "CURSOR_ERROR";
            await this.finish(
              taskId,
              taskRun.runId,
              stopReason === "SAFETY_BLOCK" ? "BLOCKED" : "FAILED",
              stopReason,
              executed.message,
            );
            break;
          }
          if (taskRun.stageIterations > this.config.maxStageIterations) {
            stopReason = "STAGE_ITERATION_LIMIT";
            await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, "Stage iteration limit");
            break;
          }
          continue;
        }

        // Planning step
        if (needsPlan) {
          printLine(verbose, `Iteration ${taskRun.iterations + 1}/${this.config.maxTaskIterations}`, true);
          printLine(verbose, "PLANNER", true);

          // Clear RETRY_REQUIRED stages conceptually by planning a NEW stage (immutable history)
          if (retryStage) {
            await this.store.updateStage(taskId, retryStage.stageId, {
              status: "FAILED",
              finishedAt: new Date().toISOString(),
            });
          }

          const plan = await planTask(this.store, this.config, taskId, {
            plannerFn: options.plannerFn,
          });
          taskRun = await this.store.updateTaskRun(taskRun.runId, {
            plannerRuns: taskRun.plannerRuns + 1,
            iterations: taskRun.iterations + 1,
            openaiTokensUsed:
              taskRun.openaiTokensUsed + (plan.planningRun?.usage.totalTokens ?? 0),
            lastStageId: plan.stage?.stageId ?? taskRun.lastStageId,
          });
          if (plan.planningRun?.usage.totalTokens) {
            task = await this.store.updateTask(taskId, {
              openaiTokensUsed:
                (task.openaiTokensUsed ?? 0) + (plan.planningRun.usage.totalTokens ?? 0),
              // Clear consumed recommendation/retry after planning attempt
              nextStageRecommendation: null,
              retryContext: plan.decision?.decision === "CREATE_STAGE" ? null : task.retryContext,
            });
          } else {
            task = await this.store.updateTask(taskId, {
              nextStageRecommendation: null,
              retryContext:
                plan.decision?.decision === "CREATE_STAGE" || plan.decision?.decision === "RETRY_STAGE"
                  ? null
                  : task.retryContext,
            });
          }

          await emit(
            taskRun.runId,
            "PLANNER",
            `PLANNER → ${plan.decision?.decision ?? plan.code}`,
            { stageId: plan.stage?.stageId },
          );

          if (plan.stage) {
            await emit(
              taskRun.runId,
              "STAGE_CREATED",
              `STAGE ${plan.stage.stageNumber} CREATED: ${plan.stage.title}`,
              { stageId: plan.stage.stageId },
            );
            printLine(verbose, `✓ Stage ${plan.stage.stageNumber} created`, true);
          }

          if (plan.code === "COMPLETED" || plan.decision?.decision === "COMPLETED") {
            stopReason = "TASK_COMPLETED";
            await this.finish(taskId, taskRun.runId, "COMPLETED", stopReason, plan.message);
            await emit(taskRun.runId, "DECISION", "TASK_COMPLETED");
            break;
          }
          if (plan.code === "HUMAN_REQUIRED" || plan.decision?.decision === "HUMAN_REQUIRED") {
            stopReason = "HUMAN_REQUIRED";
            await this.store.saveApprovalRequest({
              taskId,
              runId: taskRun.runId,
              action: "PLANNER_HUMAN_REQUIRED",
              reason: plan.message,
              riskLevel: "HIGH",
              status: "PENDING",
            });
            await this.finish(taskId, taskRun.runId, "HUMAN_REQUIRED", stopReason, plan.message);
            await emit(taskRun.runId, "DECISION", "HUMAN_REQUIRED");
            this.printHumanGate({ code: "PLANNER", severity: "HUMAN_REQUIRED", message: plan.message });
            break;
          }
          if (plan.code === "BLOCKED" || plan.decision?.decision === "BLOCKED") {
            stopReason = "SAFETY_BLOCK";
            await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, plan.message);
            await emit(taskRun.runId, "DECISION", "BLOCKED");
            break;
          }
          if (!plan.ok && plan.code !== "PLANNED") {
            stopReason = plan.code === "BUDGET_EXCEEDED" ? "BUDGET_EXCEEDED" : "PLANNER_ERROR";
            await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, plan.message);
            break;
          }

          // Reset stageIterations when a new stage is created
          if (plan.stage) {
            taskRun = await this.store.updateTaskRun(taskRun.runId, { stageIterations: 0 });
          }
          continue;
        }

        // No actionable state
        stopReason = "UNKNOWN_STATE";
        await this.finish(
          taskId,
          taskRun.runId,
          "BLOCKED",
          stopReason,
          `No actionable stage/plan state (task.status=${task.status})`,
        );
        await emit(taskRun.runId, "ERROR", "UNKNOWN_STATE");
        break;
      }

      if (!stopReason && cycles >= maxCycles) {
        stopReason = "TASK_ITERATION_LIMIT";
        await this.finish(taskId, taskRun.runId, "BLOCKED", stopReason, "Max loop cycles reached");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stopReason = "UNKNOWN_STATE";
      log.error("autonomous_error", message, { taskId });
      await this.finish(taskId, taskRun.runId, "FAILED", stopReason, message);
      await emit(taskRun.runId, "ERROR", message);
    }

    task = (await this.store.getTask(taskId))!;
    taskRun = (await this.store.getTaskRun(taskRun.runId))!;
    await this.printFinishSummary(task, taskRun, stopReason);

    return {
      ok: task.status === "COMPLETED",
      code: stopReason ?? task.status,
      message: task.lastError ?? stopReason ?? task.status,
      stopReason,
      task,
      taskRun,
      eventsSummary,
    };
  }

  private async recoverAmbiguousState(task: Task): Promise<{
    stop: boolean;
    code: string;
    message: string;
    stopReason: StopReason;
  } | { stop: false }> {
    const runningStage = task.stages.find((s) => s.status === "RUNNING");
    if (runningStage) {
      await this.store.updateStage(task.taskId, runningStage.stageId, {
        status: "BLOCKED",
        finishedAt: new Date().toISOString(),
      });
      await this.store.updateTask(task.taskId, {
        status: "BLOCKED",
        stopReason: "RECOVERY_REQUIRED",
        lastError: `Stage ${runningStage.stageId} was RUNNING without active process`,
      });
      return {
        stop: true,
        code: "RECOVERY_REQUIRED",
        message: "Ambiguous Stage RUNNING recovered to BLOCKED",
        stopReason: "RECOVERY_REQUIRED",
      };
    }

    const lockManager = new ExecutionLockManager(this.config.dataDir, this.config.lockStaleMs);
    const lock = await lockManager.readLock();
    if (lock && lock.taskId === task.taskId) {
      try {
        process.kill(lock.pid, 0);
        return {
          stop: true,
          code: "CONCURRENCY_LIMIT_REACHED",
          message: "Execution lock held by live process",
          stopReason: "CONCURRENCY_LIMIT_REACHED",
        };
      } catch {
        await lockManager.release(lock.cursorRunId, { forceStale: true });
        const cursorRun = await this.store.getCursorRun(lock.cursorRunId);
        if (cursorRun && cursorRun.status === "RUNNING") {
          await this.store.saveCursorRun({
            ...cursorRun,
            status: "FAILED",
            error: "Recovered stale RUNNING CursorRun",
            finishedAt: new Date().toISOString(),
          });
        }
      }
    }

    return { stop: false };
  }

  private async heartbeat(runId: string): Promise<TaskRunRecord> {
    return this.store.updateTaskRun(runId, {
      heartbeatAt: new Date().toISOString(),
      status: "RUNNING",
    });
  }

  private async isCancelRequested(taskId: string, runId: string): Promise<boolean> {
    const task = await this.store.getTask(taskId);
    const run = await this.store.getTaskRun(runId);
    return Boolean(task?.cancelRequested || run?.cancelRequested);
  }

  private async trackProgress(
    taskRun: TaskRunRecord,
    fingerprint: string,
    lastFingerprint: string | null,
  ): Promise<{ taskRun: TaskRunRecord; stopped: boolean }> {
    let noProgress = taskRun.noProgressCycles;
    if (lastFingerprint && fingerprint === lastFingerprint) {
      noProgress += 1;
    } else {
      noProgress = 0;
    }
    const updated = await this.store.updateTaskRun(taskRun.runId, {
      lastFingerprint: fingerprint,
      noProgressCycles: noProgress,
    });
    return {
      taskRun: updated,
      stopped: noProgress >= this.config.maxNoProgressCycles,
    };
  }

  private async handleReviewDecision(
    taskId: string,
    runId: string,
    review: Awaited<ReturnType<typeof reviewStage>>,
    emit: (
      runId: string,
      type: Parameters<JsonTaskStore["appendRunEvent"]>[0]["type"],
      message: string,
      extra?: { stageId?: string; metadata?: Record<string, unknown> },
    ) => Promise<void>,
  ): Promise<{ stop: boolean; stopReason: StopReason | null }> {
    const decision = review.decision?.decision;
    const disposition = review.decision?.taskDisposition;

    if (decision === "HUMAN_REQUIRED" || review.code === "HUMAN_REQUIRED") {
      await this.store.saveApprovalRequest({
        taskId,
        stageId: review.stage?.stageId,
        runId,
        action: "REVIEW_HUMAN_REQUIRED",
        reason: review.message,
        riskLevel: "HIGH",
        status: "PENDING",
      });
      await this.finish(taskId, runId, "HUMAN_REQUIRED", "HUMAN_REQUIRED", review.message);
      this.printHumanGate({
        code: "REVIEW",
        severity: "HUMAN_REQUIRED",
        message: review.message,
      });
      return { stop: true, stopReason: "HUMAN_REQUIRED" };
    }

    if (decision === "BLOCKED" || review.code === "BLOCKED") {
      await this.finish(taskId, runId, "BLOCKED", "SAFETY_BLOCK", review.message);
      return { stop: true, stopReason: "SAFETY_BLOCK" };
    }

    if (decision === "FAILED" || review.code === "FAILED") {
      await this.finish(taskId, runId, "FAILED", "REVIEWER_ERROR", review.message);
      return { stop: true, stopReason: "REVIEWER_ERROR" };
    }

    if (decision === "STAGE_COMPLETED" && disposition === "TASK_COMPLETED") {
      await this.finish(taskId, runId, "COMPLETED", "TASK_COMPLETED", review.message);
      await emit(runId, "DECISION", "TASK_COMPLETED");
      return { stop: true, stopReason: "TASK_COMPLETED" };
    }

    if (
      decision === "STAGE_COMPLETED" ||
      decision === "CREATE_NEXT_STAGE" ||
      decision === "RETRY_STAGE"
    ) {
      // reviewStage already set Task READY / stage statuses
      await this.store.updateTask(taskId, { status: "READY" });
      await emit(runId, "DECISION", `${decision} → continue`);
      return { stop: false, stopReason: null };
    }

    await this.finish(taskId, runId, "BLOCKED", "UNKNOWN_STATE", review.message);
    return { stop: true, stopReason: "UNKNOWN_STATE" };
  }

  private async finish(
    taskId: string,
    runId: string,
    taskStatus: Task["status"],
    stopReason: StopReason,
    message: string,
  ): Promise<void> {
    const runStatus: TaskRunStatus =
      taskStatus === "COMPLETED"
        ? "COMPLETED"
        : taskStatus === "HUMAN_REQUIRED"
          ? "HUMAN_REQUIRED"
          : taskStatus === "CANCELLED"
            ? "CANCELLED"
            : taskStatus === "FAILED"
              ? "FAILED"
              : "BLOCKED";

    await this.store.updateTask(taskId, {
      status: taskStatus,
      stopReason,
      lastError: taskStatus === "COMPLETED" ? null : message,
      cancelRequested: false,
    });
    await this.store.updateTaskRun(runId, {
      status: runStatus,
      stopReason,
      error: taskStatus === "COMPLETED" ? undefined : message,
      finishedAt: new Date().toISOString(),
      cancelRequested: false,
    });
    await this.store.appendRunEvent({
      runId,
      taskId,
      type: "RUN_FINISHED",
      message: `RUN FINISHED status=${runStatus} stopReason=${stopReason}`,
    });
  }

  private async collectTaskFilesChanged(taskId: string): Promise<string[]> {
    const runs = await this.store.listCursorRuns(taskId);
    const files = new Set<string>();
    for (const run of runs) {
      for (const f of run.filesChanged ?? []) files.add(f);
    }
    return [...files];
  }

  private printHumanGate(finding: GuardFinding): void {
    console.log("");
    console.log("=== HUMAN ACTION REQUIRED ===");
    console.log(`Reason: ${finding.message}`);
    console.log(`Code: ${finding.code}`);
    console.log("Pipeline stopped. Do not continue automatically.");
    console.log("");
  }

  private async printFinishSummary(
    task: Task,
    taskRun: TaskRunRecord,
    stopReason: StopReason | null,
  ): Promise<void> {
    const files = await this.collectTaskFilesChanged(task.taskId);
    console.log("");
    console.log("=== FINISH SUMMARY ===");
    console.log(`TASK: ${task.taskId}`);
    console.log(`STATUS: ${task.status}`);
    console.log(`STOP: ${stopReason ?? task.stopReason ?? "n/a"}`);
    console.log(`Stages: ${task.stages.length}`);
    console.log(`Planner runs: ${taskRun.plannerRuns}`);
    console.log(`Cursor runs: ${taskRun.cursorRuns}`);
    console.log(`Review runs: ${taskRun.reviewRuns}`);
    console.log(`Validation runs: ${taskRun.validationRuns}`);
    console.log(`Files changed: ${files.length}`);
    console.log(`Base commit: ${task.baseCommit ?? "n/a"}`);
    console.log(`Worktree: ${task.worktree ?? "n/a"}`);
    console.log(`OpenAI tokens: ${task.openaiTokensUsed ?? 0}`);
    console.log("Cost: null (pricing not configured)");
    console.log("Commit: NOT CREATED");
    console.log("Push: NOT PERFORMED");
    console.log("Production: NOT TOUCHED");
    if (task.worktree) {
      console.log("");
      console.log("WORKTREE READY FOR HUMAN REVIEW");
      console.log(`Path: ${task.worktree}`);
    }
    console.log("");
  }
}

export async function cancelTask(
  store: JsonTaskStore,
  taskId: string,
): Promise<{ ok: boolean; message: string; task: Task | null }> {
  const task = await store.getTask(taskId);
  if (!task) return { ok: false, message: "TASK_NOT_FOUND", task: null };

  if (isTerminalTaskStatus(task.status)) {
    return { ok: false, message: `Task already terminal: ${task.status}`, task };
  }

  const runs = await store.listTaskRuns(taskId);
  const active = runs.filter((r) => r.status === "RUNNING" || r.status === "PENDING").at(-1);
  if (active) {
    await store.updateTaskRun(active.runId, { cancelRequested: true });
  }

  const updated = await store.updateTask(taskId, {
    cancelRequested: true,
    status: active ? task.status : "CANCELLED",
    stopReason: active ? task.stopReason : "CANCELLED",
  });

  if (!active) {
    return { ok: true, message: "Task CANCELLED", task: updated };
  }
  return { ok: true, message: "Cancel requested — runner will stop at next gate", task: updated };
}
