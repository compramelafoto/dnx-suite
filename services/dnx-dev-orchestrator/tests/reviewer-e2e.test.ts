import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planTask } from "../src/agents/planner/planner.js";
import { reviewStage } from "../src/agents/reviewer/reviewer.js";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";
import { executeStage } from "../src/cursor/executor.js";
import { prepareTaskWorktree } from "../src/git/prepare-task.js";
import { gitOk } from "../src/git/exec.js";
import { JsonTaskStore } from "../src/state/store.js";
import { runDoctor } from "../src/cli/doctor.js";

async function initRepo(dir: string): Promise<void> {
  await gitOk(["init"], { cwd: dir });
  await gitOk(["config", "user.email", "test@example.com"], { cwd: dir });
  await gitOk(["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "hello\n");
  await gitOk(["add", "README.md"], { cwd: dir });
  await gitOk(["commit", "-m", "init"], { cwd: dir });
}

describe("mock end-to-end manual pipeline", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    resetOrchConfigCache();
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
  });

  afterEach(async () => {
    delete process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO;
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("task create → plan → prepare → execute → review", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-e2e-data-"));
    const repo = await mkdtemp(join(tmpdir(), "orch-e2e-repo-"));
    const wtRoot = await mkdtemp(join(tmpdir(), "orch-e2e-wt-"));
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
    });
    const store = new JsonTaskStore(dataDir);

    const task = await store.createTask({
      project: "clickaton",
      objective: "E2E mock pipeline feature",
      budgetUsd: 5,
      maxIterations: 20,
    });

    const planned = await planTask(store, config, task.taskId);
    expect(planned.ok).toBe(true);
    expect(planned.stage?.status).toBe("PENDING");

    const prepared = await prepareTaskWorktree(store, config, repo, task.taskId);
    expect(prepared.ok).toBe(true);

    const executed = await executeStage(store, config, planned.stage!.stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(executed.ok).toBe(true);
    expect(executed.stage?.status).toBe("VALIDATING");

    const reviewed = await reviewStage(store, config, planned.stage!.stageId);
    expect(reviewed.code).toBe("STAGE_COMPLETED");
    expect(reviewed.stage?.status).toBe("COMPLETED");
    expect(reviewed.task?.status).toBe("READY");
    expect(reviewed.decision?.decision).toBe("STAGE_COMPLETED");

    // No automatic next plan/cursor
    const finalTask = await store.getTask(task.taskId);
    expect(finalTask?.stages).toHaveLength(1);
    expect(finalTask?.stages[0]?.status).toBe("COMPLETED");
  });

  it("doctor reports ETAPA 05 autonomous availability with mocks", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-doc-"));
    dirs.push(dataDir);
    resetOrchConfigCache();
    process.env.DNX_ORCH_DATA_DIR = dataDir;
    process.env.DNX_ORCH_PLANNER_PROVIDER = "mock";
    process.env.DNX_ORCH_REVIEWER_PROVIDER = "mock";
    process.env.DNX_ORCH_CURSOR_PROVIDER = "mock";
    const result = await runDoctor(process.cwd());
    expect(result.text).toContain("ETAPA 06");
    expect(result.text).toContain("AUTONOMOUS SINGLE-TASK LOOP");
    expect(result.text).toContain("Reviewer provider:");
    expect(result.text).toContain("MOCK");
    expect(result.text).toContain("AUTONOMOUS LOOP:");
    expect(result.text).toContain("AVAILABLE");
    expect(result.text).toContain("AUTO COMMIT:");
    expect(result.text).toContain("DISABLED");
    delete process.env.DNX_ORCH_DATA_DIR;
    delete process.env.DNX_ORCH_PLANNER_PROVIDER;
    delete process.env.DNX_ORCH_REVIEWER_PROVIDER;
    delete process.env.DNX_ORCH_CURSOR_PROVIDER;
  });
});
