import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planTask } from "../src/agents/planner/planner.js";
import { createMockReviewDecision } from "../src/agents/reviewer/mock.js";
import { buildReviewerInput, compactReviewerInput } from "../src/agents/reviewer/input.js";
import { summarizeCursorRun } from "../src/agents/reviewer/cursor-summary.js";
import { applySafetyOverride, detectCursorSafetyViolations } from "../src/agents/reviewer/safety-gate.js";
import { invokeReviewer, reviewStage } from "../src/agents/reviewer/reviewer.js";
import { createReviewerAgent } from "../src/agents/reviewer/openai-provider.js";
import { mapSafeValidationAction, classifyProposedValidationCommand } from "../src/agents/reviewer/validation-catalog.js";
import { canContinueTask } from "../src/budget/budget.js";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";
import { executeStage } from "../src/cursor/executor.js";
import { prepareTaskWorktree } from "../src/git/prepare-task.js";
import { gitOk } from "../src/git/exec.js";
import { sanitizeMetadata } from "../src/logging/logger.js";
import { emptyUsage } from "../src/agents/planner/usage.js";
import { JsonTaskStore } from "../src/state/store.js";
import type { CursorRunRecord } from "../src/state/types.js";
import type { ReviewDecision } from "../src/agents/reviewer/schema.js";
import * as openaiReviewer from "../src/agents/reviewer/openai-provider.js";
import * as openaiPlanner from "../src/agents/planner/openai-provider.js";

async function initRepo(dir: string): Promise<void> {
  await gitOk(["init"], { cwd: dir });
  await gitOk(["config", "user.email", "test@example.com"], { cwd: dir });
  await gitOk(["config", "user.name", "Test"], { cwd: dir });
  await writeFile(join(dir, "README.md"), "hello\n");
  await gitOk(["add", "README.md"], { cwd: dir });
  await gitOk(["commit", "-m", "init"], { cwd: dir });
}

describe("reviewer flow", () => {
  const dirs: string[] = [];

  beforeEach(() => resetOrchConfigCache());
  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO;
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function setupPipeline(env: Record<string, string> = {}) {
    const dataDir = await mkdtemp(join(tmpdir(), "orch-rev-data-"));
    const repo = await mkdtemp(join(tmpdir(), "orch-rev-repo-"));
    const wtRoot = await mkdtemp(join(tmpdir(), "orch-rev-wt-"));
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
      objective: "demo feature",
      budgetUsd: 5,
      maxIterations: 20,
    });
    const planned = await planTask(store, config, task.taskId);
    expect(planned.stage).toBeTruthy();
    await prepareTaskWorktree(store, config, repo, task.taskId);
    const executed = await executeStage(store, config, planned.stage!.stageId, {
      mode: "WRITE_LIMITED",
      confirmWrite: true,
      controlPlaneRoot: repo,
      skipAuthCheck: true,
    });
    expect(executed.ok).toBe(true);
    expect(executed.stage?.status).toBe("VALIDATING");
    return {
      config,
      store,
      taskId: task.taskId,
      stageId: planned.stage!.stageId,
      cursorRunId: executed.cursorRun!.cursorRunId,
      dataDir,
    };
  }

  it("mock success completes stage and keeps task READY", async () => {
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    const result = await reviewStage(ctx.store, ctx.config, ctx.stageId);
    expect(result.code).toBe("STAGE_COMPLETED");
    expect(result.stage?.status).toBe("COMPLETED");
    expect(result.task?.status).toBe("READY");
    expect(result.reviewRun?.reviewRunId).toBeTruthy();
    const loaded = await ctx.store.getReviewRun(result.reviewRun!.reviewRunId);
    expect(loaded?.decision).toBe("STAGE_COMPLETED");
  });

  it("mock retry / human / blocked / failed / next-stage", async () => {
    for (const [scenario, expected] of [
      ["retry", "RETRY_STAGE"],
      ["human-required", "HUMAN_REQUIRED"],
      ["blocked", "BLOCKED"],
      ["failed", "FAILED"],
      ["next-stage", "CREATE_NEXT_STAGE"],
    ] as const) {
      process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = scenario;
      const ctx = await setupPipeline();
      const result = await reviewStage(ctx.store, ctx.config, ctx.stageId);
      expect(result.decision?.decision).toBe(expected);
      if (scenario === "retry") {
        expect(result.stage?.status).toBe("RETRY_REQUIRED");
        expect(result.task?.retryContext?.reviewRunId).toBeTruthy();
      }
      if (scenario === "next-stage") {
        expect(result.stage?.status).toBe("COMPLETED");
        expect(result.task?.nextStageRecommendation?.title).toBeTruthy();
      }
      if (scenario === "human-required") {
        expect(result.task?.status).toBe("HUMAN_REQUIRED");
      }
      if (scenario === "blocked") {
        expect(result.task?.status).toBe("BLOCKED");
      }
    }
  });

  it("duplicate review blocked", async () => {
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    const first = await reviewStage(ctx.store, ctx.config, ctx.stageId);
    expect(first.ok).toBe(true);
    const second = await reviewStage(ctx.store, ctx.config, ctx.stageId);
    expect(second.code).toBe("REVIEW_ALREADY_EXISTS");
  });

  it("dry-run does not change Stage/Task", async () => {
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    const beforeTask = await ctx.store.getTask(ctx.taskId);
    const beforeStage = beforeTask!.stages.find((s) => s.stageId === ctx.stageId)!;
    const result = await reviewStage(ctx.store, ctx.config, ctx.stageId, { dryRun: true });
    expect(result.code).toBe("DRY_RUN");
    const afterTask = await ctx.store.getTask(ctx.taskId);
    const afterStage = afterTask!.stages.find((s) => s.stageId === ctx.stageId)!;
    expect(afterStage.status).toBe(beforeStage.status);
    expect(afterTask!.status).toBe(beforeTask!.status);
    expect(afterStage.latestReviewRunId).toBeUndefined();
  });

  it("exitCode 0 alone does not force COMPLETED without review", async () => {
    const ctx = await setupPipeline();
    const task = await ctx.store.getTask(ctx.taskId);
    expect(task?.status).toBe("VALIDATING");
    expect(task?.stages[0]?.status).toBe("VALIDATING");
  });

  it("safety violation overrides reviewer STAGE_COMPLETED", async () => {
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    const run = await ctx.store.getCursorRun(ctx.cursorRunId);
    await ctx.store.saveCursorRun({
      ...run!,
      cursorRunId: run!.cursorRunId,
      createdAt: run!.createdAt,
      resultText: `${run!.resultText}\nI ran git push origin main to production`,
    });
    const result = await reviewStage(ctx.store, ctx.config, ctx.stageId);
    expect(result.decision?.decision).toBe("BLOCKED");
    expect(result.reviewRun?.safetyOverride).toContain("CODE_SAFETY_OVERRIDE");
    expect(result.stage?.status).toBe("BLOCKED");
  });

  it("outputTruncated reduces evidence confidence in summary", () => {
    const run: CursorRunRecord = {
      cursorRunId: "crun-x",
      taskId: "t",
      stageId: "s",
      createdAt: new Date().toISOString(),
      workspace: "/tmp",
      mode: "READ_ONLY",
      status: "COMPLETED",
      resultText: "x".repeat(50_000),
      outputTruncated: true,
      filesChanged: [],
      provider: "mock",
      exitCode: 0,
    };
    const summary = summarizeCursorRun(run, 500);
    expect(summary.outputTruncated).toBe(true);
    expect(summary.resultText).toContain("OUTPUT_TRUNCATED=true");
  });

  it("compacts reviewer input and avoids secret leakage in metadata", async () => {
    const ctx = await setupPipeline();
    const task = (await ctx.store.getTask(ctx.taskId))!;
    const stage = task.stages[0]!;
    const cursorRun = (await ctx.store.getCursorRun(ctx.cursorRunId))!;
    const input = buildReviewerInput({
      task,
      stage,
      cursorRun: {
        ...cursorRun,
        resultText: `${"y".repeat(20_000)}\nOPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz`,
      },
      budget: canContinueTask({
        taskBudgetUsd: 5,
        spentUsd: 0,
        dailyBudgetUsd: 5,
        monthlyBudgetUsd: 20,
        dailySpentUsd: 0,
        monthlySpentUsd: 0,
        iterations: 0,
        maxIterations: 20,
      }),
      maxResultChars: 1000,
      maxFilesChangedWarning: 50,
    });
    const compact = compactReviewerInput(input);
    expect(compact.cursorRunSummary.resultText.length).toBeLessThan(input.cursorRunSummary.originalResultChars);
    const sanitized = sanitizeMetadata({
      openai_api_key: "sk-abcdefghijklmnopqrstuvwxyz",
      decision: "STAGE_COMPLETED",
    });
    expect(sanitized?.openai_api_key).toBe("[REDACTED]");
  });

  it("budget fail closed", async () => {
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    await ctx.store.updateTask(ctx.taskId, { spentUsd: 5, budgetUsd: 5 });
    const config = loadOrchConfig({
      DNX_ORCH_DATA_DIR: ctx.dataDir,
      DNX_ORCH_PLANNER_PROVIDER: "mock",
      DNX_ORCH_REVIEWER_PROVIDER: "mock",
      DNX_ORCH_CURSOR_PROVIDER: "mock",
      DNX_ORCH_DAILY_BUDGET_USD: "5",
      DNX_ORCH_MONTHLY_BUDGET_USD: "20",
    });
    const result = await reviewStage(ctx.store, config, ctx.stageId);
    expect(result.code).toBe("BUDGET_EXCEEDED");
  });

  it("reviewer retry limit exhausted", async () => {
    const ctx = await setupPipeline({
      DNX_ORCH_REVIEWER_PROVIDER: "openai",
      DNX_ORCH_MAX_REVIEWER_RETRIES: "1",
      OPENAI_API_KEY: "sk-test",
    });
    let calls = 0;
    vi.spyOn(openaiReviewer, "runOpenAiReviewer").mockImplementation(async () => {
      calls += 1;
      throw new Error("transient");
    });
    await expect(
      invokeReviewer(
        buildReviewerInput({
          task: (await ctx.store.getTask(ctx.taskId))!,
          stage: (await ctx.store.getTask(ctx.taskId))!.stages[0]!,
          cursorRun: (await ctx.store.getCursorRun(ctx.cursorRunId))!,
          budget: canContinueTask({
            taskBudgetUsd: 5,
            spentUsd: 0,
            dailyBudgetUsd: 5,
            monthlyBudgetUsd: 20,
            dailySpentUsd: 0,
            monthlySpentUsd: 0,
            iterations: 0,
            maxIterations: 20,
          }),
          maxResultChars: 1000,
          maxFilesChangedWarning: 50,
        }),
        ctx.config,
      ),
    ).rejects.toThrow(/REVIEWER_RETRIES_EXHAUSTED/);
    expect(calls).toBe(2); // retries=1 → 2 attempts
  });

  it("reviewer agent has no tools; does not call planner/cursor from review path", async () => {
    const agent = createReviewerAgent("gpt-4.1-mini");
    expect(agent.tools ?? []).toEqual([]);
    const plannerSpy = vi.spyOn(openaiPlanner, "runOpenAiPlanner");
    const reviewerSpy = vi.spyOn(openaiReviewer, "runOpenAiReviewer");
    process.env.DNX_ORCH_REVIEWER_MOCK_SCENARIO = "success";
    const ctx = await setupPipeline();
    await reviewStage(ctx.store, ctx.config, ctx.stageId);
    expect(plannerSpy).not.toHaveBeenCalled();
    expect(reviewerSpy).not.toHaveBeenCalled(); // mock path
  });

  it("validation catalog maps typed actions; never trusts LLM strings", () => {
    const mapped = mapSafeValidationAction({
      type: "TYPECHECK_PACKAGE",
      package: "@dnx/dev-orchestrator",
    });
    expect(mapped?.argv).toEqual(["pnpm", "--filter", "@dnx/dev-orchestrator", "typecheck"]);
    expect(mapSafeValidationAction({ type: "TYPECHECK_PACKAGE", package: "../evil" })).toBeNull();
    const proposed = classifyProposedValidationCommand("rm -rf /");
    expect(proposed.trusted).toBe(false);
  });

  it("usage capture on injected reviewer", async () => {
    const ctx = await setupPipeline();
    const result = await reviewStage(ctx.store, ctx.config, ctx.stageId, {
      reviewerFn: async (input) => ({
        decision: createMockReviewDecision(input, "success"),
        usage: {
          inputTokens: 11,
          outputTokens: 7,
          totalTokens: 18,
          requests: 1,
        },
      }),
    });
    expect(result.usage?.totalTokens).toBe(18);
    expect(result.reviewRun?.usage.totalTokens).toBe(18);
  });

  it("detectCursorSafetyViolations finds push", () => {
    const findings = detectCursorSafetyViolations({
      cursorRunId: "c",
      taskId: "t",
      stageId: "s",
      createdAt: new Date().toISOString(),
      workspace: "/tmp",
      mode: "WRITE_LIMITED",
      status: "COMPLETED",
      resultText: "git push --force origin main",
      provider: "mock",
    });
    expect(findings.some((f) => f.code === "SAFETY_PUSH" || f.code === "SAFETY_FORCE_PUSH")).toBe(true);
    const overridden = applySafetyOverride(
      {
        decision: "STAGE_COMPLETED",
        summary: "done",
        evidence: [],
        missingEvidence: [],
        issues: [],
        retryRecommended: false,
        nextStageRecommendation: null,
        taskDisposition: "CONTINUE",
      } satisfies ReviewDecision,
      findings,
    );
    expect(overridden.decision.decision).toBe("BLOCKED");
    expect(emptyUsage().totalTokens).toBeNull();
  });
});
