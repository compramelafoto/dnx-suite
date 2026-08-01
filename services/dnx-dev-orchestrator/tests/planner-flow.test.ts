import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPlannerDecision } from "../src/agents/planner/mock.js";
import { buildPlannerInput, invokePlanner, planTask } from "../src/agents/planner/planner.js";
import { extractUsageFromRunResult, emptyUsage } from "../src/agents/planner/usage.js";
import { canContinueTask } from "../src/budget/budget.js";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";
import { sanitizeMetadata } from "../src/logging/logger.js";
import { JsonTaskStore } from "../src/state/store.js";
import * as openaiProvider from "../src/agents/planner/openai-provider.js";

describe("planner flow", () => {
  const dirs: string[] = [];

  beforeEach(() => {
    resetOrchConfigCache();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function setup() {
    const dataDir = await mkdtemp(join(tmpdir(), "dnx-orch-plan-"));
    dirs.push(dataDir);
    const config = loadOrchConfig({
      DNX_ORCH_DATA_DIR: dataDir,
      DNX_ORCH_PLANNER_PROVIDER: "mock",
    });
    const store = new JsonTaskStore(dataDir);
    const task = await store.createTask({
      project: "clickaton",
      objective: "Implementar feature X",
      budgetUsd: 5,
      maxIterations: 20,
    });
    return { config, store, task, dataDir };
  }

  it("mock planner works and persists stage", async () => {
    const { config, store, task } = await setup();
    const result = await planTask(store, config, task.taskId);
    expect(result.ok).toBe(true);
    expect(result.code).toBe("PLANNED");
    expect(result.stage?.prompt).toContain("ETAPA 01");
    expect(result.stage?.prompt).toContain("ACCIÓN LEGAL REQUERIDA");

    const loaded = await store.getTask(task.taskId);
    expect(loaded?.stages).toHaveLength(1);
    expect(loaded?.status).toBe("READY");
    expect(loaded?.lastPlanningRunId).toBeTruthy();
  });

  it("dry-run does not persist stage", async () => {
    const { config, store, task } = await setup();
    const result = await planTask(store, config, task.taskId, { dryRun: true });
    expect(result.code).toBe("DRY_RUN");
    expect(result.decision?.stage).toBeTruthy();

    const loaded = await store.getTask(task.taskId);
    expect(loaded?.stages).toHaveLength(0);
    expect(loaded?.status).toBe("PLANNING");
  });

  it("duplicate pending stage is not persisted twice", async () => {
    const { config, store, task } = await setup();
    const first = await planTask(store, config, task.taskId);
    expect(first.ok).toBe(true);

    const second = await planTask(store, config, task.taskId, {
      plannerFn: async () => {
        // Force same stageNumber as the already-pending stage.
        const decision = createMockPlannerDecision(
          buildPlannerInput(
            { ...task, stages: [] },
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
        return { decision, usage: emptyUsage() };
      },
    });
    expect(second.code).toBe("STAGE_ALREADY_EXISTS");
    const loaded = await store.getTask(task.taskId);
    expect(loaded?.stages).toHaveLength(1);
  });

  it("missing OPENAI_API_KEY fails closed for openai provider", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "dnx-orch-plan-"));
    dirs.push(dataDir);
    const config = loadOrchConfig({
      DNX_ORCH_DATA_DIR: dataDir,
      DNX_ORCH_PLANNER_PROVIDER: "openai",
      OPENAI_API_KEY: "",
    });
    const store = new JsonTaskStore(dataDir);
    const task = await store.createTask({
      project: "x",
      objective: "y",
      budgetUsd: 5,
      maxIterations: 20,
    });
    const result = await planTask(store, config, task.taskId);
    expect(result.code).toBe("OPENAI_NOT_CONFIGURED");
  });

  it("planner retries are limited", async () => {
    const { config, task } = await setup();
    let calls = 0;
    vi.spyOn(openaiProvider, "runOpenAiPlanner").mockImplementation(async () => {
      calls += 1;
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
      decision.stage!.prompt = "broken";
      return { decision, usage: emptyUsage() };
    });

    const cfg = {
      ...config,
      plannerProvider: "openai" as const,
      openaiConfigured: true,
      maxPlannerRetries: 2,
    };
    const input = buildPlannerInput(
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
    );

    await expect(invokePlanner(input, cfg)).rejects.toThrow(/PLANNER_RETRIES_EXHAUSTED/);
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("invalid plannerFn output does not persist stage", async () => {
    const { config, store, task } = await setup();
    const result = await planTask(store, config, task.taskId, {
      plannerFn: async (input) => {
        const decision = createMockPlannerDecision(input);
        decision.stage!.prompt = "broken";
        return { decision, usage: emptyUsage() };
      },
    });
    expect(result.ok).toBe(false);
    const loaded = await store.getTask(task.taskId);
    expect(loaded?.stages).toHaveLength(0);
  });

  it("parses usage when present and keeps nulls otherwise", () => {
    expect(extractUsageFromRunResult({}).totalTokens).toBeNull();
    const usage = extractUsageFromRunResult({
      state: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, requests: 1 } },
    });
    expect(usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      requests: 1,
    });
  });

  it("does not leak secrets in logger metadata", () => {
    const sanitized = sanitizeMetadata({
      OPENAI_API_KEY: "sk-secret",
      CURSOR_API_KEY: "abc",
      decision: "CREATE_STAGE",
    });
    expect(sanitized?.OPENAI_API_KEY).toBe("[REDACTED]");
    expect(sanitized?.CURSOR_API_KEY).toBe("[REDACTED]");
    expect(sanitized?.decision).toBe("CREATE_STAGE");
  });

  it("builds compact planner input", async () => {
    const { task } = await setup();
    const budget = canContinueTask({
      taskBudgetUsd: 5,
      spentUsd: 0,
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 20,
      dailySpentUsd: 0,
      monthlySpentUsd: 0,
      iterations: 0,
      maxIterations: 20,
    });
    const input = buildPlannerInput(task, budget);
    expect(input.existingStages).toEqual([]);
    expect(JSON.stringify(input)).not.toContain("OPENAI_API_KEY");
    expect(input.repositoryContext?.note).toMatch(/Minimal context/);
  });
});
