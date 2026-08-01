import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockPlannerDecision } from "../src/agents/planner/mock.js";
import { buildPlannerInput, planTask } from "../src/agents/planner/planner.js";
import { canContinueTask } from "../src/budget/budget.js";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";
import { executeStage } from "../src/cursor/executor.js";
import { prepareTaskWorktree } from "../src/git/prepare-task.js";
import { gitOk } from "../src/git/exec.js";
import { ExecutionLockManager } from "../src/runtime/lock.js";
import { truncateOutput } from "../src/runtime/truncate.js";
import { sanitizeMetadata } from "../src/logging/logger.js";
import { JsonTaskStore } from "../src/state/store.js";

async function initRepo(dir: string): Promise<void> {
  await gitOk(["init"], { cwd: dir });
  await gitOk(["config", "user.email", "test@example.com"], { cwd: dir });
  await gitOk(["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "hello\n");
  await gitOk(["add", "README.md"], { cwd: dir });
  await gitOk(["commit", "-m", "init"], { cwd: dir });
}

describe("cursor executor gates and transitions", () => {
  const dirs: string[] = [];

  beforeEach(() => resetOrchConfigCache());
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function setup(env: Record<string, string> = {}) {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-data-"));
    const repo = await mkdtemp(join(tmpdir(), "orch-repo-"));
    const wtRoot = await mkdtemp(join(tmpdir(), "orch-wt-"));
    dirs.push(dataDir, repo, wtRoot);
    await initRepo(repo);

    const config = loadOrchConfig({
      DNX_ORCH_DATA_DIR: dataDir,
      DNX_ORCH_PLANNER_PROVIDER: "mock",
      DNX_ORCH_CURSOR_PROVIDER: "mock",
      DNX_ORCH_WORKTREE_ROOT: wtRoot,
      DNX_ORCH_ALLOW_WRITE: "false",
      OPENAI_API_KEY: "",
      ...env,
    });
    const store = new JsonTaskStore(dataDir);
    const task = await store.createTask({
      project: "clickaton",
      objective: "demo feature",
      budgetUsd: 5,
      maxIterations: 20,
    });
    const planned = await planTask(store, config, task.taskId);
    expect(planned.stage).toBeTruthy();
    return { config, store, task, stageId: planned.stage!.stageId, repo, wtRoot, dataDir };
  }

  it("denies write without env and without --confirm-write", async () => {
    const { config, store, stageId, repo } = await setup();
    await prepareTaskWorktree(store, config, repo, (await store.listTasks())[0]!.taskId);

    const noConfirm = await executeStage(store, config, stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: false,
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(noConfirm.code).toBe("WRITE_NOT_AUTHORIZED");

    const withConfirmButEnvOff = await executeStage(store, config, stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(withConfirmButEnvOff.code).toBe("WRITE_NOT_AUTHORIZED");
  });

  it("denies execution without worktree", async () => {
    const { config, store, stageId, repo } = await setup();
    const result = await executeStage(store, config, stageId, {
      mode: "READ_ONLY",
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(result.code).toBe("WORKTREE_REQUIRED");
  });

  it("denies write on control-plane workspace", async () => {
    const { config, store, stageId, repo } = await setup({
      DNX_ORCH_ALLOW_WRITE: "true",
    });
    // Force task.worktree to control plane
    const task = (await store.listTasks())[0]!;
    await store.updateTask(task.taskId, { worktree: repo, branch: "dnx-orch/x", baseCommit: "abc" });

    const result = await executeStage(store, config, stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(result.code).toBe("FORBIDDEN_AUTOMATIC");
  });

  it("mock inspect sets VALIDATING and never COMPLETED on exit 0", async () => {
    const ctx = await setup();
    const taskId = (await ctx.store.listTasks())[0]!.taskId;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, taskId);

    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "READ_ONLY",
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("EXECUTED");
    expect(result.stage?.status).toBe("VALIDATING");
    expect(result.task?.status).toBe("VALIDATING");
    expect(result.stage?.status).not.toBe("COMPLETED");
    expect(result.cursorRun?.provider).toBe("mock");
  });

  it("write limited with double gate works via mock", async () => {
    const ctx = await setup({ DNX_ORCH_ALLOW_WRITE: "true" });
    const taskId = (await ctx.store.listTasks())[0]!.taskId;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, taskId);
    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.ok).toBe(true);
    expect(result.stage?.status).toBe("VALIDATING");
    expect(result.cursorRun?.filesChanged?.length).toBeGreaterThan(0);
  });

  it("forbidden/critical/human gates deny execution", async () => {
    const ctx = await setup({ DNX_ORCH_ALLOW_WRITE: "true" });
    const task = (await ctx.store.listTasks())[0]!;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, task.taskId);

    const decision = createMockPlannerDecision(
      buildPlannerInput(
        task,
        canContinueTask({
          taskBudgetUsd: 5,
          spentUsd: 0,
          dailyBudgetUsd: 5,
          monthlyBudgetUsd: 20,
          dailySpentUsd: 0,
          monthlySpentUsd: 0,
          iterations: 0,
          maxIterations: 20,
        }),
      ),
    );
    decision.stage!.allowedActions = ["DEPLOY_PRODUCTION"];
    decision.stage!.riskLevel = "LOW";

    await ctx.store.updateStage(task.taskId, ctx.stageId, {
      plan: decision.stage!,
      prompt: decision.stage!.prompt,
    });

    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.code).toBe("BLOCKED");
  });

  it("timeout handling marks TIMED_OUT / BLOCKED", async () => {
    const ctx = await setup();
    const task = (await ctx.store.listTasks())[0]!;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, task.taskId);
    await ctx.store.updateStage(task.taskId, ctx.stageId, {
      prompt: `${(await ctx.store.findStage(ctx.stageId))!.stage.prompt}\n__MOCK_TIMEOUT__\n`,
    });
    // broken envelope after mutation — force timeout via mock by plannerFn-like prompt injection
    // Re-set a valid prompt containing timeout marker inside body while keeping envelope.
    const stage = (await ctx.store.findStage(ctx.stageId))!.stage;
    const lines = stage.prompt.split("\n");
    const first = lines.find((l) => l.trim())!;
    const rebuilt = `${first}\nbody\n__MOCK_TIMEOUT__\nACCIÓN LEGAL REQUERIDA: NO\nNO comenzar automáticamente la siguiente etapa.\n${first}`;
    await ctx.store.updateStage(task.taskId, ctx.stageId, {
      prompt: rebuilt,
      plan: {
        ...stage.plan!,
        prompt: rebuilt,
      },
    });

    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "READ_ONLY",
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.code).toBe("TIMED_OUT");
    expect(result.cursorRun?.status).toBe("TIMED_OUT");
    expect(result.stage?.status).toBe("BLOCKED");
  });

  it("concurrency lock prevents parallel runs", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-lock-"));
    dirs.push(dataDir);
    const locks = new ExecutionLockManager(dataDir, 60_000);
    const a = await locks.acquire({
      cursorRunId: "crun-a",
      taskId: "t1",
      pid: process.pid,
      createdAt: new Date().toISOString(),
    });
    expect(a.ok).toBe(true);
    const b = await locks.acquire({
      cursorRunId: "crun-b",
      taskId: "t1",
      pid: process.pid,
      createdAt: new Date().toISOString(),
    });
    expect(b.ok).toBe(false);
    await locks.release("crun-a");
  });

  it("stale lock can be replaced", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-lock-"));
    dirs.push(dataDir);
    const locks = new ExecutionLockManager(dataDir, 10);
    await locks.acquire({
      cursorRunId: "crun-old",
      taskId: "t1",
      pid: 99999999,
      createdAt: new Date(Date.now() - 1000).toISOString(),
    });
    await new Promise((r) => setTimeout(r, 20));
    const next = await locks.acquire({
      cursorRunId: "crun-new",
      taskId: "t1",
      pid: process.pid,
      createdAt: new Date().toISOString(),
    });
    expect(next.ok).toBe(true);
    await locks.release("crun-new");
  });

  it("truncates large output and redacts secrets", () => {
    const big = "a".repeat(1000);
    const truncated = truncateOutput(big, 200);
    expect(truncated.truncated).toBe(true);
    expect(truncated.text.includes("OUTPUT TRUNCATED")).toBe(true);
    const sanitized = sanitizeMetadata({ OPENAI_API_KEY: "sk-x", note: "ok" });
    expect(sanitized?.OPENAI_API_KEY).toBe("[REDACTED]");
  });

  it("executor does not import/call OpenAI path", async () => {
    // Structural guarantee: executeStage with mock provider never needs OPENAI.
    const ctx = await setup({ OPENAI_API_KEY: "" });
    const taskId = (await ctx.store.listTasks())[0]!.taskId;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, taskId);
    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "READ_ONLY",
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.ok).toBe(true);
    expect(ctx.config.openaiConfigured).toBe(false);
  });

  it("persists base commit on prepare", async () => {
    const ctx = await setup();
    const taskId = (await ctx.store.listTasks())[0]!.taskId;
    const prepared = await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, taskId);
    expect(prepared.ok).toBe(true);
    expect(prepared.task?.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(prepared.task?.branch?.startsWith("dnx-orch/")).toBe(true);
  });

  it("rejects persisted stage with human-approval action", async () => {
    const ctx = await setup({ DNX_ORCH_ALLOW_WRITE: "true" });
    const task = (await ctx.store.listTasks())[0]!;
    await prepareTaskWorktree(ctx.store, ctx.config, ctx.repo, task.taskId);
    const stage = (await ctx.store.findStage(ctx.stageId))!.stage;
    await ctx.store.updateStage(task.taskId, ctx.stageId, {
      plan: {
        ...stage.plan!,
        allowedActions: ["PUSH"],
        requiresHumanApproval: false,
      },
    });
    const result = await executeStage(ctx.store, ctx.config, ctx.stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: ctx.repo,
      skipAuthCheck: true,
    });
    expect(result.code).toBe("BLOCKED");
  });
});
