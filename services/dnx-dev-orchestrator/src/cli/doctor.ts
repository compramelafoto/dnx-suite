import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { getOrchConfig } from "../config/env.js";
import { PACKAGE_ROOT } from "../config/defaults.js";
import { getCursorAgentStatus } from "../cursor/discovery.js";
import { WorktreeManager } from "../git/worktree.js";
import { JsonTaskStore } from "../state/store.js";

async function pathOk(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveRepoRoot(startDir: string): Promise<string> {
  let current = startDir;
  for (let i = 0; i < 12; i += 1) {
    if (await pathOk(join(current, ".git"))) return current;
    if (await pathOk(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

export async function runDoctor(startDir: string): Promise<{ exitCode: number; text: string }> {
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  await store.ensureReady();

  const repoRoot = await resolveRepoRoot(startDir);
  const repoOk = await pathOk(repoRoot);
  const dataOk = await pathOk(config.dataDir);
  const cursor = await getCursorAgentStatus(config.cursorBin);
  const worktreeRoot = WorktreeManager.resolveWorktreeRoot(repoRoot, config.worktreeRootEnv);

  let worktreeIsolation: "READY" | "ERROR" = "READY";
  try {
    const mgr = new WorktreeManager(repoRoot, worktreeRoot);
    await mgr.ensureWorktreeRoot();
  } catch {
    worktreeIsolation = "ERROR";
  }

  const plannerReady =
    config.plannerProvider === "mock" ||
    (config.plannerProvider === "openai" && config.openaiConfigured);

  const reviewerReady =
    config.reviewerProvider === "mock" ||
    (config.reviewerProvider === "openai" && config.openaiConfigured);

  const cursorAuthReady = cursor.auth === "AUTHENTICATED";
  const cursorReady =
    cursor.binary.found && (config.cursorProvider === "mock" || cursorAuthReady);

  const autonomousLoopAvailable = plannerReady && reviewerReady && worktreeIsolation === "READY";
  const autonomousLocalWrite =
    autonomousLoopAvailable && cursorReady && config.allowWrite
      ? "AVAILABLE"
      : cursorReady
        ? "AUTH_REQUIRED"
        : "SETUP_REQUIRED";

  const lines = [
    "DNX DEV ORCHESTRATOR",
    "",
    "CURRENT STAGE:",
    "ETAPA 06",
    "",
    "CURRENT CAPABILITY:",
    "AUTONOMOUS SINGLE-TASK LOOP",
    "LOCAL WORKTREE ONLY",
    "(first real supervised run requires OpenAI + Cursor auth)",
    "",
    "AUTONOMOUS LOOP:",
    autonomousLoopAvailable ? "AVAILABLE" : "SETUP_REQUIRED",
    "",
    "AUTONOMOUS LOCAL WRITE:",
    autonomousLocalWrite,
    "",
    "AUTO COMMIT:",
    "DISABLED",
    "",
    "REMOTE OPERATIONS:",
    "DISABLED",
    "",
    "NOTE:",
    "PLANNING ≠ EXECUTION ≠ REVIEW",
    "CONTROL PLANE ≠ EXECUTION PLANE",
    "exitCode=0 ≠ STAGE_COMPLETED",
    "",
    "Repository:",
    repoOk ? "OK" : "MISSING",
    `  ${repoRoot}`,
    "",
    "Package root:",
    `  ${PACKAGE_ROOT}`,
    "",
    "State storage:",
    dataOk ? "OK" : "MISSING",
    `  ${config.dataDir}`,
    "",
    "Planner:",
    plannerReady ? "READY" : "SETUP_REQUIRED",
    "",
    "Planner provider:",
    config.plannerProvider === "mock" ? "MOCK" : "OPENAI",
    "",
    "Reviewer:",
    reviewerReady ? "READY" : "SETUP_REQUIRED",
    "",
    "Reviewer provider:",
    config.reviewerProvider === "mock" ? "MOCK" : "OPENAI",
    "",
    "Model:",
    config.openaiModel,
    "",
    "Cursor binary:",
    cursor.binary.found ? "FOUND" : "NOT_FOUND",
    cursor.binary.path ? `  ${cursor.binary.path}` : "",
    cursor.version ? `  Version: ${cursor.version}` : "",
    "",
    "Cursor auth:",
    cursorAuthReady ? "READY" : "REQUIRED",
    cursor.loginHint ? `  ${cursor.loginHint}` : "",
    "",
    "Cursor provider:",
    config.cursorProvider === "mock" ? "MOCK" : "REAL",
    "",
    "Worktree root:",
    worktreeRoot,
    "",
    "Worktree isolation:",
    worktreeIsolation,
    "",
    "Write env:",
    config.allowWrite ? "ENABLED" : "DISABLED",
    "  (still requires --confirm-write)",
    "",
    "Push:",
    "DISABLED",
    "",
    "Deploy:",
    "DISABLED",
    "",
    "Production:",
    "DISABLED",
    "",
    "Concurrent agents:",
    String(config.maxConcurrentAgents),
    "",
    "STATUS:",
  ];

  let status = "SETUP_REQUIRED";
  if (autonomousLoopAvailable && autonomousLocalWrite === "AVAILABLE") {
    status = "AUTONOMOUS_WRITE_READY";
  } else if (autonomousLoopAvailable && cursorReady) {
    status = "AUTONOMOUS_SAFE_READY";
  } else if (autonomousLoopAvailable) {
    status = "AUTONOMOUS_LOOP_AVAILABLE";
  } else if (plannerReady && reviewerReady) {
    status = "REVIEW_READY";
  }
  lines.push(status);

  const text = lines.filter((l) => l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
  return { exitCode: 0, text };
}
