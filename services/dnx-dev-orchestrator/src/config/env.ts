import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { DEFAULTS } from "./defaults.js";

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (value === undefined || value === "") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  });

const positiveNumber = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return fallback;
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({
          code: "custom",
          message: `Expected non-negative number, got ${String(value)}`,
        });
        return z.NEVER;
      }
      return n;
    });

const positiveInt = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return fallback;
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({
          code: "custom",
          message: `Expected positive integer, got ${String(value)}`,
        });
        return z.NEVER;
      }
      return n;
    });

const nonNegativeInt = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === "") return fallback;
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({
          code: "custom",
          message: `Expected non-negative integer, got ${String(value)}`,
        });
        return z.NEVER;
      }
      return n;
    });

export const orchEnvSchema = z.object({
  DNX_ORCH_DATA_DIR: z.string().optional(),
  DNX_ORCH_CURSOR_BIN: z.string().optional(),
  DNX_ORCH_CURSOR_TIMEOUT_MS: positiveNumber(DEFAULTS.cursorTimeoutMs),
  DNX_ORCH_MAX_TASK_ITERATIONS: positiveInt(DEFAULTS.maxTaskIterations),
  DNX_ORCH_MAX_STAGE_ITERATIONS: positiveInt(DEFAULTS.maxStageIterations),
  DNX_ORCH_DAILY_BUDGET_USD: positiveNumber(DEFAULTS.dailyBudgetUsd),
  DNX_ORCH_MONTHLY_BUDGET_USD: positiveNumber(DEFAULTS.monthlyBudgetUsd),
  DNX_ORCH_MAX_CONCURRENT_AGENTS: positiveInt(DEFAULTS.maxConcurrentAgents),
  DNX_ORCH_ALLOW_WRITE: boolFromEnv,
  DNX_ORCH_OPENAI_MODEL: z.string().optional(),
  DNX_ORCH_MAX_PLANNER_RETRIES: nonNegativeInt(DEFAULTS.maxPlannerRetries),
  DNX_ORCH_MAX_REVIEWER_RETRIES: nonNegativeInt(DEFAULTS.maxReviewerRetries),
  DNX_ORCH_PLANNER_PROVIDER: z.enum(["openai", "mock"]).optional(),
  DNX_ORCH_REVIEWER_PROVIDER: z.enum(["openai", "mock"]).optional(),
  DNX_ORCH_CURSOR_PROVIDER: z.enum(["real", "mock"]).optional(),
  DNX_ORCH_WORKTREE_ROOT: z.string().optional(),
  DNX_ORCH_DEFAULT_BASE_REF: z.string().optional(),
  DNX_ORCH_MAX_CURSOR_OUTPUT_CHARS: positiveInt(DEFAULTS.maxCursorOutputChars),
  DNX_ORCH_MAX_FILES_CHANGED_WARNING: positiveInt(DEFAULTS.maxFilesChangedWarning),
  DNX_ORCH_MAX_FILES_CHANGED_PER_STAGE: positiveInt(DEFAULTS.maxFilesChangedPerStage),
  DNX_ORCH_MAX_TOTAL_FILES_CHANGED_PER_TASK: positiveInt(DEFAULTS.maxTotalFilesChangedPerTask),
  DNX_ORCH_MAX_CHANGED_LINES_PER_STAGE: positiveInt(DEFAULTS.maxChangedLinesPerStage),
  DNX_ORCH_MAX_NO_PROGRESS_CYCLES: positiveInt(DEFAULTS.maxNoProgressCycles),
  DNX_ORCH_MAX_OPENAI_TOKENS_PER_TASK: positiveInt(DEFAULTS.maxOpenAiTokensPerTask),
  DNX_ORCH_VALIDATION_TIMEOUT_MS: positiveNumber(DEFAULTS.validationTimeoutMs),
  DNX_ORCH_LOCK_STALE_MS: positiveNumber(DEFAULTS.lockStaleMs),
  OPENAI_API_KEY: z.string().optional(),
});

export type OrchEnv = z.infer<typeof orchEnvSchema>;

export type PlannerProvider = "openai" | "mock";
export type ReviewerProvider = "openai" | "mock";
export type CursorProvider = "real" | "mock";
export type AutonomyLevel = "READ_ONLY" | "LOCAL_WRITE";

export type OrchConfig = {
  dataDir: string;
  cursorBin: string | undefined;
  cursorTimeoutMs: number;
  maxTaskIterations: number;
  maxStageIterations: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxConcurrentAgents: number;
  allowWrite: boolean;
  writeEnvEnabled: boolean;
  openaiConfigured: boolean;
  openaiModel: string;
  maxPlannerRetries: number;
  maxReviewerRetries: number;
  plannerProvider: PlannerProvider;
  reviewerProvider: ReviewerProvider;
  cursorProvider: CursorProvider;
  openaiSdkInstalled: true;
  worktreeRootEnv: string | undefined;
  defaultBaseRef: string | undefined;
  maxCursorOutputChars: number;
  maxFilesChangedWarning: number;
  maxFilesChangedPerStage: number;
  maxTotalFilesChangedPerTask: number;
  maxChangedLinesPerStage: number;
  maxNoProgressCycles: number;
  maxOpenAiTokensPerTask: number;
  validationTimeoutMs: number;
  lockStaleMs: number;
};

let cachedConfig: OrchConfig | undefined;

function detectOpenAiKey(env: NodeJS.ProcessEnv): boolean {
  const key = env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

export function loadOrchConfig(env: NodeJS.ProcessEnv = process.env): OrchConfig {
  loadDotenv({ quiet: true });

  const parsed = orchEnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid DNX orchestrator env: ${details}`);
  }

  const data = parsed.data;
  const allowWrite = data.DNX_ORCH_ALLOW_WRITE;

  return {
    dataDir: data.DNX_ORCH_DATA_DIR?.trim() || DEFAULTS.dataDir,
    cursorBin: data.DNX_ORCH_CURSOR_BIN?.trim() || undefined,
    cursorTimeoutMs: data.DNX_ORCH_CURSOR_TIMEOUT_MS,
    maxTaskIterations: data.DNX_ORCH_MAX_TASK_ITERATIONS,
    maxStageIterations: data.DNX_ORCH_MAX_STAGE_ITERATIONS,
    dailyBudgetUsd: data.DNX_ORCH_DAILY_BUDGET_USD,
    monthlyBudgetUsd: data.DNX_ORCH_MONTHLY_BUDGET_USD,
    maxConcurrentAgents: Math.min(1, data.DNX_ORCH_MAX_CONCURRENT_AGENTS),
    allowWrite,
    writeEnvEnabled: allowWrite,
    openaiConfigured: detectOpenAiKey(env),
    openaiModel: data.DNX_ORCH_OPENAI_MODEL?.trim() || DEFAULTS.openaiModel,
    maxPlannerRetries: data.DNX_ORCH_MAX_PLANNER_RETRIES,
    maxReviewerRetries: data.DNX_ORCH_MAX_REVIEWER_RETRIES,
    plannerProvider: data.DNX_ORCH_PLANNER_PROVIDER ?? DEFAULTS.plannerProvider,
    reviewerProvider: data.DNX_ORCH_REVIEWER_PROVIDER ?? DEFAULTS.reviewerProvider,
    cursorProvider: data.DNX_ORCH_CURSOR_PROVIDER ?? DEFAULTS.cursorProvider,
    openaiSdkInstalled: true,
    worktreeRootEnv: data.DNX_ORCH_WORKTREE_ROOT?.trim() || undefined,
    defaultBaseRef: data.DNX_ORCH_DEFAULT_BASE_REF?.trim() || undefined,
    maxCursorOutputChars: data.DNX_ORCH_MAX_CURSOR_OUTPUT_CHARS,
    maxFilesChangedWarning: data.DNX_ORCH_MAX_FILES_CHANGED_WARNING,
    maxFilesChangedPerStage: data.DNX_ORCH_MAX_FILES_CHANGED_PER_STAGE,
    maxTotalFilesChangedPerTask: data.DNX_ORCH_MAX_TOTAL_FILES_CHANGED_PER_TASK,
    maxChangedLinesPerStage: data.DNX_ORCH_MAX_CHANGED_LINES_PER_STAGE,
    maxNoProgressCycles: data.DNX_ORCH_MAX_NO_PROGRESS_CYCLES,
    maxOpenAiTokensPerTask: data.DNX_ORCH_MAX_OPENAI_TOKENS_PER_TASK,
    validationTimeoutMs: data.DNX_ORCH_VALIDATION_TIMEOUT_MS,
    lockStaleMs: data.DNX_ORCH_LOCK_STALE_MS,
  };
}

export function getOrchConfig(env: NodeJS.ProcessEnv = process.env): OrchConfig {
  if (!cachedConfig) {
    cachedConfig = loadOrchConfig(env);
  }
  return cachedConfig;
}

/** Test helper — clears memoized config. */
export function resetOrchConfigCache(): void {
  cachedConfig = undefined;
}
