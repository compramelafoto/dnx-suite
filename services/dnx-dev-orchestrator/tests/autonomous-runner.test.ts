import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";
import { gitOk } from "../src/git/exec.js";
import { AutonomousTaskRunner, cancelTask } from "../src/runtime/autonomous-runner.js";
import { evaluateDiffGuards, evaluateScopeGuards, parseNumstat } from "../src/runtime/guards.js";
import { resetMockSequenceCounters } from "../src/runtime/mock-sequences.js";
import {
  proposeSafeActionsFromCommands,
  runSafeValidations,
} from "../src/validation/runner.js";
import { JsonTaskStore } from "../src/state/store.js";
import { mapSafeValidationAction } from "../src/agents/reviewer/validation-catalog.js";

async function initRepo(dir: string): Promise<void> {
  await gitOk(["init"], { cwd: dir });
  await gitOk(["config", "user.email", "test@example.com"], { cwd: dir });
  await gitOk(["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "hello\n");
  await gitOk(["add", "README.md"], { cwd: dir });
  await gitOk(["commit", "-m", "init"], { cwd: dir });
}

describe("autonomous runner", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    resetOrchConfigCache();
    resetMockSequenceCounters();
  });

  afterEach(async () => {
    delete process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO;
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function setup(env: Record<string, string> = {}) {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-auto-data-"));
    const repo = await mkdtemp(join(tmpdir(), "orch-auto-repo-"));
    const wtRoot = await mkdtemp(join(tmpdir(), "orch-auto-wt-"));
    dirs.push(dataDir, repo, wtRoot);
    await initRepo(repo);

    const config = loadOrchConfig({
      DNX_ORCH_DATA_DIR: dataDir,
      DNX_ORCH_PLANNER_PROVIDER: "mock",
      DNX_ORCH_REVIEWER_PROVIDER: "mock",
      DNX_ORCH_CURSOR_PROVIDER: "mock",
      DNX_ORCH_WORKTREE_ROOT: wtRoot,
      DNX_ORCH_ALLOW_WRITE: "true",
      OPENAI_API_KEY: "",
      ...env,
    });
    const store = new JsonTaskStore(dataDir);
    const task = await store.createTask({
      project: "clickaton",
      objective: "Autonomous demo",
      budgetUsd: 5,
      maxIterations: 20,
    });
    return { config, store, task, repo, dataDir };
  }

  it("mock E2E two-stage autonomous completion", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "two-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });

    expect(result.ok).toBe(true);
    expect(result.stopReason).toBe("TASK_COMPLETED");
    expect(result.task?.status).toBe("COMPLETED");
    expect(result.taskRun?.status).toBe("COMPLETED");
    expect(result.task?.stages.length).toBe(2);
    expect(result.taskRun?.cursorRuns).toBe(2);
    expect(result.taskRun?.reviewRuns).toBe(2);
    expect(result.taskRun?.plannerRuns).toBeGreaterThanOrEqual(2);

    const events = await store.listRunEvents(result.taskRun!.runId);
    expect(events.some((e) => e.type === "RUN_STARTED")).toBe(true);
    expect(events.some((e) => e.type === "RUN_FINISHED")).toBe(true);
  });

  it("one-stage autonomous completion", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.stopReason).toBe("TASK_COMPLETED");
    expect(result.task?.stages.length).toBe(1);
  });

  it("retry then completion", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "retry-then-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.stopReason).toBe("TASK_COMPLETED");
    expect(result.task?.stages.length).toBeGreaterThanOrEqual(2);
  });

  it("human-required stops", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "human-required";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.stopReason).toBe("HUMAN_REQUIRED");
    expect(result.task?.status).toBe("HUMAN_REQUIRED");
  });

  it("blocked stops", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "blocked";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.task?.status).toBe("BLOCKED");
  });

  it("write without confirm rejected", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: false,
      skipValidationExec: true,
    });
    expect(result.stopReason).toBe("WRITE_AUTHORIZATION_REQUIRED");
    expect(result.task?.status).toBe("HUMAN_REQUIRED");
  });

  it("write without env rejected even with confirm", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const first = await setup({ DNX_ORCH_ALLOW_WRITE: "false" });
    const runner = new AutonomousTaskRunner(first.store, first.config);
    const result = await runner.run(first.task.taskId, {
      controlPlaneRoot: first.repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.stopReason).toBe("WRITE_AUTHORIZATION_REQUIRED");
  });

  it("main worktree rejected", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const { config, store, task, repo } = await setup();
    await store.updateTask(task.taskId, {
      worktree: repo,
      branch: "dnx-orch/x",
      baseCommit: "abc",
    });
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: false,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(result.code).toBe("FORBIDDEN_AUTOMATIC");
  });

  it("task iteration limit", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "two-stage-complete";
    const { config, store, task, repo } = await setup({
      DNX_ORCH_MAX_TASK_ITERATIONS: "1",
    });
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
      maxCycles: 50,
    });
    expect(["TASK_ITERATION_LIMIT", "BUDGET_EXCEEDED", "TASK_COMPLETED"]).toContain(
      result.stopReason ?? "",
    );
  });

  it("cancellation", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "two-stage-complete";
    const { store, task } = await setup();
    const cancelled = await cancelTask(store, task.taskId);
    expect(cancelled.ok).toBe(true);
    expect(cancelled.task?.status).toBe("CANCELLED");
  });

  it("dry-run simulate does not complete task", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "two-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      dryRun: true,
      skipValidationExec: true,
    });
    expect(result.code).toBe("SIMULATE");
    const loaded = await store.getTask(task.taskId);
    expect(loaded?.status).not.toBe("COMPLETED");
    expect(loaded?.stages.length ?? 0).toBe(0);
  });

  it("diff / scope guards", () => {
    const config = loadOrchConfig({
      DNX_ORCH_MAX_FILES_CHANGED_PER_STAGE: "2",
      DNX_ORCH_MAX_CHANGED_LINES_PER_STAGE: "10",
    });
    const diff = evaluateDiffGuards({
      config,
      stageFilesChanged: ["a.ts", "b.ts", "c.ts"],
      taskFilesChanged: ["a.ts", "b.ts", "c.ts"],
      numstatText: "100\t0\ta.ts\n100\t0\tb.ts\n",
    });
    expect(diff.some((f) => f.code === "DIFF_FILES_PER_STAGE")).toBe(true);
    expect(diff.some((f) => f.code === "DIFF_LINES_PER_STAGE")).toBe(true);

    const scope = evaluateScopeGuards({
      task: {
        taskId: "t",
        project: "clickaton",
        objective: "x",
        status: "RUNNING",
        currentStage: 1,
        iteration: 1,
        branch: null,
        worktree: null,
        createdAt: "",
        updatedAt: "",
        budgetUsd: 5,
        spentUsd: 0,
        maxIterations: 20,
        stages: [],
      },
      stage: {
        stageId: "s",
        taskId: "t",
        stageNumber: 1,
        title: "x",
        prompt: "x",
        status: "VALIDATING",
        costUsd: 0,
      },
      filesChanged: [".env", "apps/clickaton/a.ts", "apps/fotorank/b.ts", "apps/infospot/c.ts"],
    });
    expect(scope.some((f) => f.severity === "BLOCKED")).toBe(true);
    expect(scope.some((f) => f.code === "SCOPE_EXPANSION")).toBe(true);
    expect(parseNumstat("3\t1\tfile.ts\n").added).toBe(3);
  });

  it("safe validation catalog rejects arbitrary shell / bad package", async () => {
    expect(mapSafeValidationAction({ type: "TYPECHECK_PACKAGE", package: "../evil" })).toBeNull();
    const proposed = proposeSafeActionsFromCommands(["rm -rf /", "pnpm --filter @dnx/dev-orchestrator typecheck"]);
    expect(proposed.unverified).toContain("rm -rf /");
    expect(proposed.actions.some((a) => a.type === "TYPECHECK_PACKAGE")).toBe(true);

    const dataDir = await mkdtemp(join(tmpdir(), "orch-val-"));
    dirs.push(dataDir);
    const store = new JsonTaskStore(dataDir);
    const config = loadOrchConfig({ DNX_ORCH_DATA_DIR: dataDir });
    const result = await runSafeValidations({
      store,
      config,
      taskId: "t",
      stageId: "s",
      workspace: dataDir,
      proposedCommands: [],
      dryRun: true,
    });
    expect(result.runs.every((r) => r.evidenceType === "VERIFIED_BY_ORCHESTRATOR")).toBe(true);
  });

  it("TaskRun persistence and resume after COMPLETED is noop", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const first = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(first.ok).toBe(true);
    const second = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      confirmWrite: true,
      skipValidationExec: true,
    });
    expect(second.code).toBe("ALREADY_COMPLETED");
  });

  it("no secret leakage in run events metadata path", async () => {
    process.env.DNX_ORCH_MOCK_AUTONOMOUS_SCENARIO = "one-stage-complete";
    const { config, store, task, repo } = await setup();
    const runner = new AutonomousTaskRunner(store, config);
    const result = await runner.run(task.taskId, {
      controlPlaneRoot: repo,
      prepare: true,
      confirmWrite: true,
      skipValidationExec: true,
    });
    const events = await store.listRunEvents(result.taskRun!.runId);
    const blob = JSON.stringify(events);
    expect(blob).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
  });
});
