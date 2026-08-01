export type BudgetSnapshot = {
  taskBudgetUsd: number;
  spentUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  dailySpentUsd: number;
  monthlySpentUsd: number;
  iterations: number;
  maxIterations: number;
};

export type BudgetDecision = {
  allowed: boolean;
  reason: string;
  remainingTaskBudget: number;
  remainingDailyBudget: number;
  remainingMonthlyBudget: number;
};
