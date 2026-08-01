import { describe, expect, it } from "vitest";
import { canContinueTask } from "../src/budget/budget.js";

describe("budget hard stop", () => {
  const base = {
    taskBudgetUsd: 5,
    spentUsd: 1,
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 20,
    dailySpentUsd: 1,
    monthlySpentUsd: 2,
    iterations: 0,
    maxIterations: 20,
  };

  it("allows when within limits", () => {
    const decision = canContinueTask(base);
    expect(decision.allowed).toBe(true);
    expect(decision.remainingTaskBudget).toBe(4);
  });

  it("stops when task budget exhausted", () => {
    const decision = canContinueTask({ ...base, spentUsd: 5 });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Task budget exhausted/);
  });

  it("stops when iterations exhausted", () => {
    const decision = canContinueTask({ ...base, iterations: 20, maxIterations: 20 });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Max task iterations/);
  });

  it("fails closed on invalid numbers", () => {
    const decision = canContinueTask({ ...base, spentUsd: Number.NaN });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Budget calculation failed/);
  });
});
