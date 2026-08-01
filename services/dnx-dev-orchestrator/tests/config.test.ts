import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULTS } from "../src/config/defaults.js";
import { loadOrchConfig, resetOrchConfigCache } from "../src/config/env.js";

describe("config defaults", () => {
  beforeEach(() => {
    resetOrchConfigCache();
  });

  it("applies safe defaults", () => {
    const config = loadOrchConfig({ OPENAI_API_KEY: "" });
    expect(config.cursorTimeoutMs).toBe(DEFAULTS.cursorTimeoutMs);
    expect(config.maxTaskIterations).toBe(20);
    expect(config.maxStageIterations).toBe(5);
    expect(config.dailyBudgetUsd).toBe(5);
    expect(config.monthlyBudgetUsd).toBe(20);
    expect(config.maxConcurrentAgents).toBe(1);
    expect(config.allowWrite).toBe(false);
    expect(config.writeEnvEnabled).toBe(false);
    expect(config.openaiConfigured).toBe(false);
    expect(config.openaiModel).toBe(DEFAULTS.openaiModel);
    expect(config.maxPlannerRetries).toBe(2);
    expect(config.maxReviewerRetries).toBe(2);
    expect(config.plannerProvider).toBe("openai");
    expect(config.reviewerProvider).toBe("openai");
    expect(config.cursorProvider).toBe("real");
    expect(config.maxCursorOutputChars).toBe(200_000);
    expect(config.maxFilesChangedWarning).toBe(50);
    expect(config.maxFilesChangedPerStage).toBe(30);
    expect(config.maxTotalFilesChangedPerTask).toBe(100);
    expect(config.maxChangedLinesPerStage).toBe(5000);
    expect(config.maxNoProgressCycles).toBe(3);
    expect(config.maxOpenAiTokensPerTask).toBe(500_000);
    expect(config.openaiSdkInstalled).toBe(true);
  });

  it("parses allowWrite true as env gate only", () => {
    const config = loadOrchConfig({
      DNX_ORCH_ALLOW_WRITE: "true",
      DNX_ORCH_DAILY_BUDGET_USD: "12.5",
      DNX_ORCH_MAX_CONCURRENT_AGENTS: "3",
      DNX_ORCH_PLANNER_PROVIDER: "mock",
      DNX_ORCH_REVIEWER_PROVIDER: "mock",
      DNX_ORCH_CURSOR_PROVIDER: "mock",
      OPENAI_API_KEY: "sk-test",
    });
    expect(config.allowWrite).toBe(true);
    expect(config.writeEnvEnabled).toBe(true);
    expect(config.dailyBudgetUsd).toBe(12.5);
    expect(config.maxConcurrentAgents).toBe(1); // capped at 1 in ETAPA 03
    expect(config.plannerProvider).toBe("mock");
    expect(config.reviewerProvider).toBe("mock");
    expect(config.cursorProvider).toBe("mock");
    expect(config.openaiConfigured).toBe(true);
  });

  it("fails closed on invalid numbers", () => {
    expect(() =>
      loadOrchConfig({
        DNX_ORCH_DAILY_BUDGET_USD: "not-a-number",
      }),
    ).toThrow(/Invalid DNX orchestrator env/);
  });
});
