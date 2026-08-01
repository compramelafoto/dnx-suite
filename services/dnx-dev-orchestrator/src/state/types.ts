import type { StagePlan } from "../agents/planner/schema.js";
import type { OpenAiUsage, PlanningRunStatus } from "../agents/planner/types.js";
import type {
  NextStageRecommendation,
  ReviewDecision,
  ReviewIssue,
  TaskDisposition,
} from "../agents/reviewer/schema.js";

export const TASK_STATUSES = [
  "PLANNING",
  "READY",
  "RUNNING",
  "VALIDATING",
  "BLOCKED",
  "HUMAN_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STAGE_STATUSES = [
  "PENDING",
  "RUNNING",
  "VALIDATING",
  "RETRY_REQUIRED",
  "BLOCKED",
  "HUMAN_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type StageStatus = (typeof STAGE_STATUSES)[number];

export type NextStageRecommendationRecord = NextStageRecommendation;

export type RetryContext = {
  issues: ReviewIssue[];
  missingEvidence: string[];
  cursorRunId: string;
  reviewRunId: string;
  summary: string;
};

export type Task = {
  taskId: string;
  project: string;
  objective: string;
  status: TaskStatus;
  currentStage: number;
  iteration: number;
  branch: string | null;
  worktree: string | null;
  baseRef?: string | null;
  baseCommit?: string | null;
  createdAt: string;
  updatedAt: string;
  budgetUsd: number;
  spentUsd: number;
  maxIterations: number;
  lastError?: string;
  lastPlanningRunId?: string;
  lastCursorRunId?: string;
  lastReviewRunId?: string;
  lastTaskRunId?: string;
  nextStageRecommendation?: NextStageRecommendationRecord | null;
  retryContext?: RetryContext | null;
  cancelRequested?: boolean;
  stopReason?: string | null;
  openaiTokensUsed?: number;
  stages: Stage[];
};

export type Stage = {
  stageId: string;
  taskId: string;
  stageNumber: number;
  title: string;
  prompt: string;
  cursorRunId?: string;
  cursorOutput?: string;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  costUsd: number;
  planningRunId?: string;
  plan?: StagePlan;
  scopeWarnings?: string[];
  latestReviewRunId?: string;
  latestCursorRunId?: string;
};

export type PlanningRunRecord = {
  planningRunId: string;
  taskId: string;
  createdAt: string;
  model: string;
  provider: "openai" | "mock";
  decision: string | null;
  reason: string;
  usage: OpenAiUsage;
  costUsd: number | null;
  status: PlanningRunStatus;
  error?: string;
  stagePlan?: StagePlan | null;
  dryRun: boolean;
  attempts: number;
};

export type CursorRunMode = "READ_ONLY" | "WRITE_LIMITED";

export type CursorRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED"
  | "TIMED_OUT";

export type CursorRunRecord = {
  cursorRunId: string;
  taskId: string;
  stageId: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  workspace: string;
  mode: CursorRunMode;
  status: CursorRunStatus;
  cursorVersion?: string;
  exitCode?: number | null;
  signal?: string | null;
  stdout?: string;
  stderr?: string;
  resultText?: string;
  outputTruncated?: boolean;
  filesChanged?: string[];
  gitDiffStat?: string;
  gitStatusBefore?: string;
  gitStatusAfter?: string;
  headBefore?: string;
  headAfter?: string;
  branchName?: string;
  durationMs?: number;
  costUsd?: number | null;
  scopeWarnings?: string[];
  error?: string;
  provider: "real" | "mock";
};

export type ReviewRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED";

export type ReviewRunRecord = {
  reviewRunId: string;
  taskId: string;
  stageId: string;
  cursorRunId: string;
  createdAt: string;
  model: string;
  provider: "openai" | "mock";
  status: ReviewRunStatus;
  decision?: ReviewDecision["decision"] | null;
  summary?: string;
  evidence?: string[];
  missingEvidence?: string[];
  issues?: ReviewIssue[];
  nextStageRecommendation?: NextStageRecommendation | null;
  taskDisposition?: TaskDisposition;
  usage: OpenAiUsage;
  costUsd: number | null;
  error?: string;
  dryRun: boolean;
  attempts: number;
  safetyOverride?: string | null;
};

export type ValidationEvidenceType =
  | "CLAIMED_BY_CURSOR"
  | "VERIFIED_BY_ORCHESTRATOR"
  | "GIT_OBSERVED"
  | "HUMAN_PROVIDED";

export type ValidationRunStatus =
  | "PENDING"
  | "RUNNING"
  | "PASSED"
  | "FAILED"
  | "BLOCKED"
  | "TIMED_OUT";

export type ValidationCommandType =
  | "TYPECHECK_PACKAGE"
  | "TEST_PACKAGE"
  | "LINT_PACKAGE"
  | "GIT_STATUS"
  | "GIT_DIFF_STAT";

export type ValidationRunRecord = {
  validationRunId: string;
  taskId: string;
  stageId: string;
  cursorRunId?: string;
  createdAt: string;
  commandType: ValidationCommandType;
  commandDisplay: string;
  status: ValidationRunStatus;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  evidenceType: ValidationEvidenceType;
};

export type AutonomyLevel = "READ_ONLY" | "LOCAL_WRITE";

export type TaskRunMode = "MANUAL" | "AUTONOMOUS_SAFE" | "AUTONOMOUS_WRITE" | "SIMULATE";

export type TaskRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "BLOCKED"
  | "HUMAN_REQUIRED"
  | "FAILED"
  | "CANCELLED";

export type TaskRunRecord = {
  runId: string;
  taskId: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  heartbeatAt?: string;
  mode: TaskRunMode;
  autonomyLevel: AutonomyLevel;
  status: TaskRunStatus;
  stopReason?: string | null;
  iterations: number;
  stageIterations: number;
  plannerRuns: number;
  cursorRuns: number;
  reviewRuns: number;
  validationRuns: number;
  openaiTokensUsed: number;
  lastStageId?: string | null;
  lastCursorRunId?: string | null;
  lastReviewRunId?: string | null;
  lastFingerprint?: string | null;
  noProgressCycles: number;
  cancelRequested: boolean;
  error?: string;
  pid?: number;
};

export type RunEventType =
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "HEARTBEAT"
  | "PLANNER"
  | "STAGE_CREATED"
  | "CURSOR"
  | "REVIEWER"
  | "VALIDATION"
  | "GUARD"
  | "DECISION"
  | "CANCEL"
  | "RECOVERY"
  | "ERROR"
  | "INFO";

export type RunEventRecord = {
  eventId: string;
  runId: string;
  taskId: string;
  timestamp: string;
  type: RunEventType;
  stageId?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type ApprovalRequestRecord = {
  approvalRequestId: string;
  taskId: string;
  stageId?: string;
  runId?: string;
  createdAt: string;
  action: string;
  reason: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: ApprovalStatus;
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
};

export type TaskDocument = Task;
