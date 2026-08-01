import type { BudgetDecision } from "../../budget/types.js";
import type { Stage, Task, ReviewRunRecord } from "../../state/types.js";
import type { StagePlan } from "../planner/schema.js";
import type { OpenAiUsage } from "../planner/types.js";
import type { ReviewDecision } from "./schema.js";

export type ValidationEvidenceType =
  | "CLAIMED_BY_CURSOR"
  | "VERIFIED_BY_ORCHESTRATOR"
  | "GIT_OBSERVED"
  | "HUMAN_PROVIDED";

export type CursorRunSummary = {
  cursorRunId: string;
  status: string;
  mode: string;
  exitCode: number | null;
  durationMs: number | null;
  resultText: string;
  outputTruncated: boolean;
  originalResultChars: number;
  filesChanged: string[];
  filesChangedCount: number;
  gitDiffStat: string;
  gitStatusBefore: string;
  gitStatusAfter: string;
  error: string | null;
  provider: string;
};

export type ValidationEvidenceItem = {
  label: string;
  evidenceType: ValidationEvidenceType;
  detail: string;
  passed: boolean | null;
};

export type ReviewerInput = {
  taskSummary: {
    taskId: string;
    project: string;
    objective: string;
    status: string;
    currentStage: number;
    iteration: number;
    maxIterations: number;
  };
  stagePlan: StagePlan | null;
  stagePromptMetadata: {
    stageId: string;
    stageNumber: number;
    title: string;
    status: string;
    promptEnvelopeHint: string;
    completionCriteria: string[];
    validationCommandsProposed: string[];
  };
  cursorRunSummary: CursorRunSummary;
  gitEvidence: {
    filesChanged: string[];
    gitDiffStat: string;
    gitStatusBefore: string;
    gitStatusAfter: string;
    emptyDiffWarning: boolean;
    filesChangedWarning: boolean;
    filesChangedWarningThreshold: number;
  };
  validationEvidence: ValidationEvidenceItem[];
  safetyContext: {
    policyLines: string[];
    programmaticFindings: string[];
    codeSafetyOverridesModel: true;
  };
  budgetStatus: BudgetDecision;
  previousRelevantStageSummary?: {
    stageId: string;
    title: string;
    status: string;
  } | null;
};

export type ReviewCommandResult = {
  ok: boolean;
  code:
    | "REVIEWED"
    | "STAGE_COMPLETED"
    | "RETRY_STAGE"
    | "CREATE_NEXT_STAGE"
    | "HUMAN_REQUIRED"
    | "BLOCKED"
    | "FAILED"
    | "REVIEW_ALREADY_EXISTS"
    | "OPENAI_NOT_CONFIGURED"
    | "BUDGET_EXCEEDED"
    | "STAGE_NOT_FOUND"
    | "CURSOR_RUN_NOT_FOUND"
    | "CURSOR_RUN_NOT_REVIEWABLE"
    | "VALIDATION_FAILED"
    | "DRY_RUN";
  message: string;
  reviewRun: ReviewRunRecord | null;
  decision: ReviewDecision | null;
  task: Task | null;
  stage: Stage | null;
  usage?: OpenAiUsage;
};
