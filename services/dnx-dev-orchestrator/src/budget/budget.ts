import type { BudgetDecision, BudgetSnapshot } from "./types.js";

function finiteOrNull(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

/**
 * Fail-closed budget gate. Any invalid number → not allowed.
 */
export function canContinueTask(snapshot: BudgetSnapshot): BudgetDecision {
  const fields: Array<[string, number]> = [
    ["taskBudgetUsd", snapshot.taskBudgetUsd],
    ["spentUsd", snapshot.spentUsd],
    ["dailyBudgetUsd", snapshot.dailyBudgetUsd],
    ["monthlyBudgetUsd", snapshot.monthlyBudgetUsd],
    ["dailySpentUsd", snapshot.dailySpentUsd],
    ["monthlySpentUsd", snapshot.monthlySpentUsd],
    ["iterations", snapshot.iterations],
    ["maxIterations", snapshot.maxIterations],
  ];

  for (const [name, value] of fields) {
    if (finiteOrNull(value) === null || value < 0) {
      return {
        allowed: false,
        reason: `Budget calculation failed: invalid ${name}`,
        remainingTaskBudget: 0,
        remainingDailyBudget: 0,
        remainingMonthlyBudget: 0,
      };
    }
  }

  const remainingTaskBudget = snapshot.taskBudgetUsd - snapshot.spentUsd;
  const remainingDailyBudget = snapshot.dailyBudgetUsd - snapshot.dailySpentUsd;
  const remainingMonthlyBudget = snapshot.monthlyBudgetUsd - snapshot.monthlySpentUsd;

  if (snapshot.iterations >= snapshot.maxIterations) {
    return {
      allowed: false,
      reason: `Max task iterations reached (${snapshot.iterations}/${snapshot.maxIterations})`,
      remainingTaskBudget,
      remainingDailyBudget,
      remainingMonthlyBudget,
    };
  }

  if (remainingTaskBudget <= 0) {
    return {
      allowed: false,
      reason: "Task budget exhausted",
      remainingTaskBudget,
      remainingDailyBudget,
      remainingMonthlyBudget,
    };
  }

  if (remainingDailyBudget <= 0) {
    return {
      allowed: false,
      reason: "Daily budget exhausted",
      remainingTaskBudget,
      remainingDailyBudget,
      remainingMonthlyBudget,
    };
  }

  if (remainingMonthlyBudget <= 0) {
    return {
      allowed: false,
      reason: "Monthly budget exhausted",
      remainingTaskBudget,
      remainingDailyBudget,
      remainingMonthlyBudget,
    };
  }

  return {
    allowed: true,
    reason: "Within budget and iteration limits",
    remainingTaskBudget,
    remainingDailyBudget,
    remainingMonthlyBudget,
  };
}
