import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Default OpenAI model for planning.
 * Chosen for structured-output + Agents SDK compatibility at moderate cost.
 * Override with DNX_ORCH_OPENAI_MODEL. Avoid Pro/high-cost models as default.
 */
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export const DEFAULTS = {
  dataDir: join(packageRoot, ".data"),
  cursorTimeoutMs: 300_000,
  maxTaskIterations: 20,
  maxStageIterations: 5,
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 20,
  maxConcurrentAgents: 1,
  allowWrite: false,
  openaiModel: DEFAULT_OPENAI_MODEL,
  maxPlannerRetries: 2,
  maxReviewerRetries: 2,
  plannerProvider: "openai" as const,
  reviewerProvider: "openai" as const,
  cursorProvider: "real" as const,
  maxCursorOutputChars: 200_000,
  maxFilesChangedWarning: 50,
  maxFilesChangedPerStage: 30,
  maxTotalFilesChangedPerTask: 100,
  maxChangedLinesPerStage: 5000,
  maxNoProgressCycles: 3,
  maxOpenAiTokensPerTask: 500_000,
  validationTimeoutMs: 120_000,
  /** Empty string means: resolve dynamically to control-plane current branch. */
  defaultBaseRef: "",
  lockStaleMs: 2 * 60 * 60 * 1000,
} as const;

export const PACKAGE_ROOT = packageRoot;

/** Sibling of the monorepo root: <parent>/dnx-orchestrator-worktrees */
export function defaultWorktreeRoot(repoRoot: string): string {
  return join(dirname(repoRoot), "dnx-orchestrator-worktrees");
}
