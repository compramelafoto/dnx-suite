import { canContinueTask } from "../budget/budget.js";
import type { OrchConfig } from "../config/env.js";
import { WorktreeManager } from "../git/worktree.js";
import {
  assertNotControlPlaneWorkspace,
  assertPathInsideTaskWorktree,
  assertPathInsideWorktreeRoot,
  resolveRealPath,
} from "../git/paths.js";
import { createLogger } from "../logging/logger.js";
import { ExecutionLockManager } from "../runtime/lock.js";
import { truncateOutput } from "../runtime/truncate.js";
import { evaluateStagePlanSafety } from "../agents/planner/safety-gate.js";
import { validateStagePlanContract } from "../agents/planner/prompt-contract.js";
import { validatePlannerDecision } from "../agents/planner/validate.js";
import { JsonTaskStore } from "../state/store.js";
import type { CursorRunMode, CursorRunRecord, Stage, Task } from "../state/types.js";
import { createCursorRunId } from "../state/ids.js";
import { getCursorAgentStatus, runCursorCommand } from "./discovery.js";
import { buildExecutionPrompt } from "./execution-prompt.js";
import { runMockCursor } from "./mock.js";

const log = createLogger("cursor-executor");

export type ExecuteStageOptions = {
  mode: CursorRunMode;
  confirmWrite?: boolean;
  controlPlaneRoot: string;
  /** Injected for tests — must not call OpenAI. */
  cursorRunner?: typeof runCursorCommand;
  skipAuthCheck?: boolean;
};

export type ExecuteStageResult = {
  ok: boolean;
  code:
    | "EXECUTED"
    | "WRITE_NOT_AUTHORIZED"
    | "CURSOR_AUTH_REQUIRED"
    | "READ_ONLY_NOT_GUARANTEED"
    | "FORBIDDEN_AUTOMATIC"
    | "BLOCKED"
    | "FAILED"
    | "TIMED_OUT"
    | "LOCK_BUSY"
    | "STAGE_NOT_FOUND"
    | "WORKTREE_REQUIRED";
  message: string;
  cursorRun: CursorRunRecord | null;
  task: Task | null;
  stage: Stage | null;
};

function revalidatePersistedStage(stage: Stage): { ok: true } | { ok: false; reason: string } {
  if (!stage.plan) {
    // Minimal contract still required on prompt.
    const contract = validateStagePlanContract({
      stageNumber: stage.stageNumber,
      title: stage.title,
      objective: stage.title,
      prompt: stage.prompt,
      riskLevel: "LOW",
      estimatedComplexity: "LOW",
      requiresHumanApproval: false,
      allowedActions: ["READ_REPO"],
      forbiddenActions: [],
      validationCommands: [],
      completionCriteria: ["manual review"],
      legalActionRequired: false,
      legalNotes: null,
    });
    return contract.ok ? { ok: true } : contract;
  }

  const decision = validatePlannerDecision({
    decision: "CREATE_STAGE",
    reason: "revalidate persisted stage",
    stage: stage.plan,
  });
  if (!decision.ok) {
    return { ok: false, reason: decision.reason };
  }
  const safety = evaluateStagePlanSafety(stage.plan);
  if (!safety.ok) {
    return { ok: false, reason: safety.reason };
  }
  if (stage.plan.riskLevel === "CRITICAL") {
    return { ok: false, reason: "CRITICAL risk blocked" };
  }
  if (stage.plan.requiresHumanApproval) {
    return { ok: false, reason: "Stage requires human approval" };
  }
  return { ok: true };
}

export async function executeStage(
  store: JsonTaskStore,
  config: OrchConfig,
  stageId: string,
  options: ExecuteStageOptions,
): Promise<ExecuteStageResult> {
  const found = await store.findStage(stageId);
  if (!found) {
    return {
      ok: false,
      code: "STAGE_NOT_FOUND",
      message: `Stage not found: ${stageId}`,
      cursorRun: null,
      task: null,
      stage: null,
    };
  }

  const { task, stage } = found;

  if (options.mode === "WRITE_LIMITED") {
    if (!config.allowWrite || !options.confirmWrite) {
      return {
        ok: false,
        code: "WRITE_NOT_AUTHORIZED",
        message:
          "WRITE_NOT_AUTHORIZED. Requires DNX_ORCH_ALLOW_WRITE=true AND --confirm-write.",
        cursorRun: null,
        task,
        stage,
      };
    }
  }

  if (!task.worktree) {
    return {
      ok: false,
      code: "WORKTREE_REQUIRED",
      message: "Task has no dedicated worktree. Run: dnx-orch task prepare <taskId>",
      cursorRun: null,
      task,
      stage,
    };
  }

  if (stage.status !== "PENDING" && stage.status !== "VALIDATING") {
    return {
      ok: false,
      code: "BLOCKED",
      message: `Stage status ${stage.status} is not executable`,
      cursorRun: null,
      task,
      stage,
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
      code: "BLOCKED",
      message: budget.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const revalidation = revalidatePersistedStage(stage);
  if (!revalidation.ok) {
    return {
      ok: false,
      code: "BLOCKED",
      message: `Persisted stage failed revalidation: ${revalidation.reason}`,
      cursorRun: null,
      task,
      stage,
    };
  }

  const worktreeRoot = WorktreeManager.resolveWorktreeRoot(
    options.controlPlaneRoot,
    config.worktreeRootEnv,
  );
  const workspaceContainment = await assertPathInsideWorktreeRoot(task.worktree, worktreeRoot);
  if (!workspaceContainment.ok) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      message: workspaceContainment.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const notControl = await assertNotControlPlaneWorkspace(
    task.worktree,
    options.controlPlaneRoot,
  );
  if (!notControl.ok) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      message: notControl.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const insideTask = await assertPathInsideTaskWorktree(task.worktree, task.worktree);
  if (!insideTask.ok) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      message: insideTask.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const workspaceReal = await resolveRealPath(task.worktree);
  if (workspaceReal !== (await resolveRealPath(task.worktree))) {
    return {
      ok: false,
      code: "FORBIDDEN_AUTOMATIC",
      message: "Workspace realpath mismatch",
      cursorRun: null,
      task,
      stage,
    };
  }

  // Auth check for real provider
  if (config.cursorProvider === "real" && !options.skipAuthCheck) {
    const status = await getCursorAgentStatus(config.cursorBin);
    if (status.auth !== "AUTHENTICATED") {
      return {
        ok: false,
        code: "CURSOR_AUTH_REQUIRED",
        message:
          status.loginHint ??
          "CURSOR_AUTH_REQUIRED. Run manually: ~/.local/bin/agent login",
        cursorRun: null,
        task,
        stage,
      };
    }
  }

  if (options.mode === "READ_ONLY") {
    // Must guarantee ask mode.
  } else if (options.mode === "WRITE_LIMITED") {
    // WRITE uses --print without --mode ask; still never --force/--approve-mcps.
  }

  const execPrompt = buildExecutionPrompt({
    persistedPrompt: stage.prompt,
    stageNumber: stage.stageNumber,
    title: stage.title,
    workspace: workspaceReal,
    mode: options.mode,
  });
  if (!execPrompt.ok) {
    return {
      ok: false,
      code: "BLOCKED",
      message: execPrompt.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const cursorRunId = createCursorRunId();
  const lockManager = new ExecutionLockManager(config.dataDir, config.lockStaleMs);
  const lock = await lockManager.acquire({
    cursorRunId,
    taskId: task.taskId,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });
  if (!lock.ok) {
    return {
      ok: false,
      code: "LOCK_BUSY",
      message: lock.reason,
      cursorRun: null,
      task,
      stage,
    };
  }

  const wt = new WorktreeManager(options.controlPlaneRoot, worktreeRoot);
  const before = await wt.captureGitSnapshot(workspaceReal);
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  await store.updateTask(task.taskId, { status: "RUNNING", lastCursorRunId: cursorRunId });
  await store.updateStage(task.taskId, stage.stageId, {
    status: "RUNNING",
    startedAt,
    cursorRunId,
  });

  let exitCode: number | null = null;
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const signal: string | null = null;
  let simulatedFiles: string[] = [];
  let error: string | undefined;

  try {
    if (config.cursorProvider === "mock") {
      const mock = await runMockCursor({
        mode: options.mode,
        workspace: workspaceReal,
        prompt: execPrompt.prompt,
      });
      exitCode = mock.timedOut ? null : mock.code;
      stdout = mock.stdout;
      stderr = mock.stderr;
      timedOut = mock.timedOut;
      simulatedFiles = mock.simulatedFilesChanged;
    } else {
      const runner = options.cursorRunner ?? runCursorCommand;
      const binaryStatus = await getCursorAgentStatus(config.cursorBin);
      const binary = binaryStatus.binary.path;
      if (!binary) {
        throw new Error("BINARY_NOT_FOUND");
      }

      const args =
        options.mode === "READ_ONLY"
          ? [
              "--mode",
              "ask",
              "--print",
              "--output-format",
              "text",
              "--workspace",
              workspaceReal,
              execPrompt.prompt,
            ]
          : [
              "--print",
              "--output-format",
              "text",
              "--workspace",
              workspaceReal,
              execPrompt.prompt,
            ];

      const forbidden = ["--force", "--approve-mcps", "--sandbox=disabled"];
      if (args.some((a) => forbidden.includes(a))) {
        throw new Error("READ_ONLY_NOT_GUARANTEED: forbidden flags");
      }
      if (options.mode === "READ_ONLY" && !args.includes("ask")) {
        throw new Error("READ_ONLY_NOT_GUARANTEED");
      }

      const result = await runner(binary, args, { timeoutMs: config.cursorTimeoutMs });
      exitCode = result.code;
      stdout = result.stdout;
      stderr = result.stderr;
      timedOut = result.timedOut;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedMs;
  const after =
    config.cursorProvider === "mock"
      ? {
          ...before,
          nameOnly: simulatedFiles,
          diffStat: simulatedFiles.length
            ? `${simulatedFiles.length} files changed (mock)`
            : "",
          statusPorcelain: simulatedFiles.map((f) => ` M ${f}`).join("\n"),
        }
      : await wt.captureGitSnapshot(workspaceReal);

  const truncatedOut = truncateOutput(stdout, config.maxCursorOutputChars);
  const truncatedErr = truncateOutput(stderr, config.maxCursorOutputChars);

  let runStatus: CursorRunRecord["status"] = "COMPLETED";
  let resultCode: ExecuteStageResult["code"] = "EXECUTED";
  if (timedOut) {
    runStatus = "TIMED_OUT";
    resultCode = "TIMED_OUT";
    error = error ?? "Cursor timed out";
  } else if (error) {
    runStatus = error.includes("READ_ONLY_NOT_GUARANTEED") ? "BLOCKED" : "FAILED";
    resultCode = error.includes("READ_ONLY_NOT_GUARANTEED")
      ? "READ_ONLY_NOT_GUARANTEED"
      : "FAILED";
  } else if (exitCode !== 0) {
    runStatus = "FAILED";
    resultCode = "FAILED";
    error = `Cursor exited with code ${String(exitCode)}`;
  }

  const cursorRun = await store.saveCursorRun({
    cursorRunId,
    taskId: task.taskId,
    stageId: stage.stageId,
    startedAt,
    finishedAt,
    workspace: workspaceReal,
    mode: options.mode,
    status: runStatus,
    exitCode,
    signal,
    stdout: truncatedOut.text,
    stderr: truncatedErr.text,
    resultText: truncatedOut.text,
    outputTruncated: truncatedOut.truncated || truncatedErr.truncated,
    filesChanged: after.nameOnly,
    gitDiffStat: after.diffStat,
    gitStatusBefore: before.statusPorcelain,
    gitStatusAfter: after.statusPorcelain,
    headBefore: before.head,
    headAfter: after.head,
    branchName: after.branch,
    durationMs,
    costUsd: null,
    scopeWarnings: [],
    error,
    provider: config.cursorProvider,
  });

  // Critical: exitCode=0 does NOT mean stage COMPLETED.
  const technicalSuccess = runStatus === "COMPLETED";
  const nextStageStatus = technicalSuccess ? "VALIDATING" : timedOut ? "BLOCKED" : "FAILED";
  const nextTaskStatus = technicalSuccess ? "VALIDATING" : "BLOCKED";

  const updatedStage = await store.updateStage(task.taskId, stage.stageId, {
    status: nextStageStatus,
    finishedAt,
    cursorRunId,
    latestCursorRunId: cursorRunId,
    cursorOutput: truncatedOut.text,
  });
  const updatedTask = await store.updateTask(task.taskId, {
    status: nextTaskStatus,
    lastCursorRunId: cursorRunId,
    lastError: technicalSuccess ? null : error ?? "Cursor execution failed",
    iteration: task.iteration + 1,
  });

  await lockManager.release(cursorRunId);

  log.info("cursor_run_finished", `Cursor run ${runStatus}`, {
    taskId: task.taskId,
    stageId: stage.stageId,
    metadata: {
      cursorRunId,
      mode: options.mode,
      provider: config.cursorProvider,
      exitCode,
      stageStatus: nextStageStatus,
    },
  });

  return {
    ok: technicalSuccess,
    code: resultCode,
    message: technicalSuccess
      ? "Cursor execution captured. Stage set to VALIDATING (not COMPLETED)."
      : error ?? "Cursor execution failed",
    cursorRun,
    task: updatedTask,
    stage: updatedStage,
  };
}
