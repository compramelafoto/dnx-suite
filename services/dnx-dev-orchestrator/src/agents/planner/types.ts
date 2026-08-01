import type { BudgetDecision } from "../../budget/types.js";
import type {
  NextStageRecommendationRecord,
  RetryContext,
  Task,
  Stage,
} from "../../state/types.js";
import type { PlannerDecision, StagePlan } from "./schema.js";

export type OpenAiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  requests: number | null;
};

export type StageSummary = {
  stageId: string;
  stageNumber: number;
  title: string;
  status: string;
  hasPrompt: boolean;
  costUsd: number;
};

export type LastReviewSummary = {
  reviewRunId: string;
  decision: string | null;
  summary: string;
  issues: string[];
};

export type PlannerInput = {
  task: Pick<
    Task,
    "taskId" | "project" | "objective" | "status" | "currentStage" | "iteration" | "maxIterations" | "budgetUsd" | "spentUsd"
  >;
  existingStages: StageSummary[];
  safetyPolicySummary: string[];
  budgetStatus: BudgetDecision;
  retryContext?: RetryContext | null;
  nextStageRecommendation?: NextStageRecommendationRecord | null;
  lastReviewSummary?: LastReviewSummary | null;
  repositoryContext?: {
    repoName: string;
    note: string;
  };
};

export type PlanningRunStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED"
  | "DRY_RUN"
  | "STAGE_ALREADY_EXISTS";

export type PlanningRun = {
  planningRunId: string;
  taskId: string;
  createdAt: string;
  model: string;
  provider: "openai" | "mock";
  decision: PlannerDecision["decision"] | null;
  reason: string;
  usage: OpenAiUsage;
  costUsd: number | null;
  status: PlanningRunStatus;
  error?: string;
  stagePlan?: StagePlan | null;
  dryRun: boolean;
  attempts: number;
};

export type PlanCommandResult = {
  ok: boolean;
  code:
    | "PLANNED"
    | "COMPLETED"
    | "HUMAN_REQUIRED"
    | "BLOCKED"
    | "STAGE_ALREADY_EXISTS"
    | "OPENAI_NOT_CONFIGURED"
    | "BUDGET_EXCEEDED"
    | "TASK_NOT_FOUND"
    | "VALIDATION_FAILED"
    | "DRY_RUN";
  message: string;
  planningRun: PlanningRun | null;
  decision: PlannerDecision | null;
  task: Task | null;
  stage: Stage | null;
};
