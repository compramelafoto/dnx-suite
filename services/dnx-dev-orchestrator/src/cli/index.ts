#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planTask } from "../agents/planner/planner.js";
import { smokeOpenAiPlanner } from "../agents/planner/openai-provider.js";
import { reviewStage } from "../agents/reviewer/reviewer.js";
import { smokeOpenAiReviewer } from "../agents/reviewer/openai-provider.js";
import { getOrchConfig, resetOrchConfigCache } from "../config/env.js";
import { executeStage } from "../cursor/executor.js";
import { getCursorAgentStatus } from "../cursor/discovery.js";
import { prepareTaskWorktree } from "../git/prepare-task.js";
import { WorktreeManager } from "../git/worktree.js";
import { createLogger } from "../logging/logger.js";
import { AutonomousTaskRunner, cancelTask } from "../runtime/autonomous-runner.js";
import { evaluateAction, getSafetyMatrix } from "../safety/policy.js";
import { JsonTaskStore } from "../state/store.js";
import { resolveRepoRoot, runDoctor } from "./doctor.js";

const log = createLogger("cli");

function printHelp(): void {
  console.log(`DNX Dev Orchestrator (dnx-orch)

CURRENT STAGE: ETAPA 06
CURRENT CAPABILITY: AUTONOMOUS SINGLE-TASK LOOP (LOCAL WORKTREE ONLY)
PIPELINE: AUTONOMOUS (manual steps still available)
FIRST REAL RUN: requires OPENAI_API_KEY + Cursor login (see docs/first-real-run.md)
AUTO COMMIT / PUSH / DEPLOY: DISABLED

Usage:
  dnx-orch doctor
  dnx-orch status
  dnx-orch safety
  dnx-orch cursor status
  dnx-orch task create --project <name> --objective "<text>"
  dnx-orch task show <taskId>
  dnx-orch task prepare <taskId> [--base-ref <ref>]
  dnx-orch task worktree <taskId>
  dnx-orch task cancel <taskId>
  dnx-orch plan <taskId> [--dry-run]
  dnx-orch stage inspect <stageId>
  dnx-orch stage execute <stageId> --confirm-write
  dnx-orch review <stageId> [--dry-run]
  dnx-orch run <taskId> [--prepare] [--confirm-write] [--dry-run] [--verbose]
  dnx-orch resume <taskId> [--confirm-write] [--verbose]
  dnx-orch run show <cursorRunId>
  dnx-orch run list [--task <taskId>]
  dnx-orch task-run show <runId>
  dnx-orch reviewer smoke --confirm
  dnx-orch help

CRITICAL:
  Never execute Cursor on the dirty control-plane working tree.
  Local write requires: DNX_ORCH_ALLOW_WRITE=true AND --confirm-write
  exitCode=0 ≠ STAGE_COMPLETED — only Reviewer decides.
`);
}

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function cmdDoctor(startDir: string): Promise<number> {
  const result = await runDoctor(startDir);
  console.log(result.text);
  return result.exitCode;
}

async function cmdStatus(): Promise<number> {
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const tasks = await store.listTasks();
  if (tasks.length === 0) {
    console.log("No tasks found.");
    return 0;
  }
  for (const task of tasks) {
    console.log(
      [
        task.taskId,
        `project=${task.project}`,
        `status=${task.status}`,
        `iteration=${task.iteration}`,
        `stages=${task.stages.length}`,
        `worktree=${task.worktree ? "yes" : "no"}`,
      ].join("  "),
    );
  }
  return 0;
}

async function cmdSafety(): Promise<number> {
  console.log("DNX DEV ORCHESTRATOR — SAFETY MATRIX");
  console.log("Philosophy: FAIL CLOSED / CODE POLICY > MODEL OUTPUT");
  console.log("Write requires: DNX_ORCH_ALLOW_WRITE=true + --confirm-write");
  console.log("");
  for (const row of getSafetyMatrix()) {
    const evaluation = evaluateAction(row.action, { writeExecutionEnabled: false });
    console.log(
      `${row.action.padEnd(28)} ${row.classification.padEnd(24)} allowed=${evaluation.allowed ? "yes" : "no"}`,
    );
  }
  return 0;
}

async function cmdCursorStatus(): Promise<number> {
  const config = getOrchConfig();
  const status = await getCursorAgentStatus(config.cursorBin);
  console.log("Cursor binary:");
  console.log(status.binary.found ? "FOUND" : "NOT_FOUND");
  if (status.binary.path) console.log(`  ${status.binary.path}`);
  console.log("");
  console.log("Version:");
  console.log(status.version ?? "UNKNOWN");
  console.log("");
  console.log("Auth:");
  console.log(status.auth === "AUTHENTICATED" ? "READY" : "REQUIRED");
  if (status.loginHint) console.log(`  ${status.loginHint}`);
  console.log("");
  console.log("Provider:");
  console.log(config.cursorProvider === "mock" ? "MOCK" : "REAL");
  console.log("");
  console.log("Write policy:");
  console.log(config.allowWrite ? "ENABLED_BY_ENV" : "DISABLED");
  console.log("  (still requires --confirm-write for stage execute)");
  return 0;
}

async function cmdTaskCreate(args: string[]): Promise<number> {
  const project = getFlag(args, "--project");
  const objective = getFlag(args, "--objective");
  if (!project || !objective) {
    console.error('Usage: dnx-orch task create --project <name> --objective "<text>"');
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const task = await store.createTask({
    project,
    objective,
    budgetUsd: config.dailyBudgetUsd,
    maxIterations: config.maxTaskIterations,
  });
  console.log("Task created:");
  console.log(JSON.stringify(task, null, 2));
  return 0;
}

async function cmdTaskShow(taskId: string | undefined): Promise<number> {
  if (!taskId) {
    console.error("Usage: dnx-orch task show <taskId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const task = await store.getTask(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    return 1;
  }
  console.log(JSON.stringify(task, null, 2));
  return 0;
}

async function cmdTaskPrepare(args: string[], cwd: string): Promise<number> {
  const taskId = args.find((a) => !a.startsWith("--"));
  if (!taskId) {
    console.error("Usage: dnx-orch task prepare <taskId> [--base-ref <ref>]");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const repoRoot = await resolveRepoRoot(cwd);
  const result = await prepareTaskWorktree(store, config, repoRoot, taskId, {
    baseRef: getFlag(args, "--base-ref"),
  });
  console.log(`code=${result.code}`);
  console.log(`message=${result.message}`);
  if (result.task) {
    console.log(`branch=${result.task.branch}`);
    console.log(`worktree=${result.task.worktree}`);
    console.log(`baseRef=${result.task.baseRef}`);
    console.log(`baseCommit=${result.task.baseCommit}`);
  }
  return result.ok ? 0 : 1;
}

async function cmdTaskWorktree(taskId: string | undefined, cwd: string): Promise<number> {
  if (!taskId) {
    console.error("Usage: dnx-orch task worktree <taskId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const task = await store.getTask(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    return 1;
  }
  const repoRoot = await resolveRepoRoot(cwd);
  const worktreeRoot = WorktreeManager.resolveWorktreeRoot(repoRoot, config.worktreeRootEnv);
  const mgr = new WorktreeManager(repoRoot, worktreeRoot);
  const inspect = await mgr.inspectTaskWorktree(task.worktree);
  console.log(JSON.stringify({ taskId, ...inspect, configuredWorktree: task.worktree, branch: task.branch, baseCommit: task.baseCommit }, null, 2));
  return 0;
}

async function cmdPlan(args: string[]): Promise<number> {
  const taskId = args.find((a) => !a.startsWith("--"));
  if (!taskId) {
    console.error("Usage: dnx-orch plan <taskId> [--dry-run]");
    return 1;
  }
  const dryRun = hasFlag(args, "--dry-run");
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const result = await planTask(store, config, taskId, { dryRun });
  console.log(`code=${result.code}`);
  console.log(`ok=${result.ok}`);
  console.log(`message=${result.message}`);
  if (result.decision) {
    console.log(`decision=${result.decision.decision}`);
  }
  if (result.stage) {
    console.log(`stageId=${result.stage.stageId}`);
    console.log("");
    console.log("=== STAGE PROMPT ===");
    console.log(result.stage.prompt);
    console.log("=== END STAGE PROMPT ===");
  } else if (result.decision?.stage && dryRun) {
    console.log("");
    console.log("=== DRY-RUN STAGE PROMPT (NOT PERSISTED) ===");
    console.log(result.decision.stage.prompt);
    console.log("=== END DRY-RUN STAGE PROMPT ===");
  }
  return result.ok || result.code === "DRY_RUN" || result.code === "COMPLETED" ? 0 : 1;
}

async function cmdStageInspect(stageId: string | undefined, cwd: string): Promise<number> {
  if (!stageId) {
    console.error("Usage: dnx-orch stage inspect <stageId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const repoRoot = await resolveRepoRoot(cwd);
  const result = await executeStage(store, config, stageId, {
    mode: "READ_ONLY",
    confirmWrite: false,
    controlPlaneRoot: repoRoot,
    skipAuthCheck: config.cursorProvider === "mock",
  });
  console.log(`code=${result.code}`);
  console.log(`message=${result.message}`);
  if (result.cursorRun) {
    console.log(`cursorRunId=${result.cursorRun.cursorRunId}`);
    console.log(`stageStatus=${result.stage?.status}`);
    console.log(`taskStatus=${result.task?.status}`);
    console.log("");
    console.log("=== RESULT TEXT ===");
    console.log(result.cursorRun.resultText ?? "");
  }
  return result.ok ? 0 : 1;
}

async function cmdStageExecute(args: string[], cwd: string): Promise<number> {
  const stageId = args.find((a) => !a.startsWith("--"));
  if (!stageId) {
    console.error("Usage: dnx-orch stage execute <stageId> --confirm-write");
    return 1;
  }
  if (!hasFlag(args, "--confirm-write")) {
    console.error("WRITE_NOT_AUTHORIZED. Pass --confirm-write (and DNX_ORCH_ALLOW_WRITE=true).");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const repoRoot = await resolveRepoRoot(cwd);
  const result = await executeStage(store, config, stageId, {
    mode: "WRITE_LIMITED",
    confirmWrite: true,
    controlPlaneRoot: repoRoot,
    skipAuthCheck: config.cursorProvider === "mock",
  });
  console.log(`code=${result.code}`);
  console.log(`message=${result.message}`);
  if (result.cursorRun) {
    console.log(`cursorRunId=${result.cursorRun.cursorRunId}`);
    console.log(`stageStatus=${result.stage?.status}`);
    console.log(`taskStatus=${result.task?.status}`);
    console.log(`filesChanged=${(result.cursorRun.filesChanged ?? []).join(",")}`);
  }
  return result.ok ? 0 : 1;
}

async function cmdRunShow(cursorRunId: string | undefined): Promise<number> {
  if (!cursorRunId) {
    console.error("Usage: dnx-orch run show <cursorRunId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const run = await store.getCursorRun(cursorRunId);
  if (!run) {
    console.error(`CursorRun not found: ${cursorRunId}`);
    return 1;
  }
  console.log(JSON.stringify(run, null, 2));
  return 0;
}

async function cmdRunList(args: string[]): Promise<number> {
  const taskId = getFlag(args, "--task");
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const runs = await store.listCursorRuns(taskId);
  if (runs.length === 0) {
    console.log("No cursor runs found.");
    return 0;
  }
  for (const run of runs) {
    console.log(
      [
        run.cursorRunId,
        `task=${run.taskId}`,
        `stage=${run.stageId}`,
        `mode=${run.mode}`,
        `status=${run.status}`,
        `exit=${String(run.exitCode)}`,
      ].join("  "),
    );
  }
  return 0;
}

async function cmdPlannerSmoke(args: string[]): Promise<number> {
  const config = getOrchConfig();
  if (config.plannerProvider === "mock") {
    console.log("Planner provider is MOCK. Smoke against OpenAI skipped.");
    return 0;
  }
  if (!config.openaiConfigured) {
    console.error("OPENAI_NOT_CONFIGURED");
    return 1;
  }
  if (!hasFlag(args, "--confirm")) {
    console.log("Run manually: dnx-orch planner smoke --confirm");
    return 0;
  }
  const result = await smokeOpenAiPlanner(config.openaiModel);
  console.log(result.ok ? "SMOKE_OK" : "SMOKE_FAILED");
  console.log(result.message);
  return result.ok ? 0 : 1;
}

async function cmdReview(args: string[]): Promise<number> {
  const stageId = args.find((a) => !a.startsWith("--"));
  if (!stageId) {
    console.error("Usage: dnx-orch review <stageId> [--dry-run]");
    return 1;
  }
  const dryRun = hasFlag(args, "--dry-run");
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const result = await reviewStage(store, config, stageId, { dryRun });

  console.log(`code=${result.code}`);
  console.log(`ok=${result.ok}`);
  console.log(`message=${result.message}`);
  if (result.decision) {
    console.log(`decision=${result.decision.decision}`);
    console.log(`summary=${result.decision.summary}`);
    console.log(`taskDisposition=${result.decision.taskDisposition}`);
    if (result.decision.evidence.length > 0) {
      console.log("evidence:");
      for (const item of result.decision.evidence) console.log(`  - ${item}`);
    }
    if (result.decision.missingEvidence.length > 0) {
      console.log("missingEvidence:");
      for (const item of result.decision.missingEvidence) console.log(`  - ${item}`);
    }
    if (result.decision.issues.length > 0) {
      console.log("issues:");
      for (const issue of result.decision.issues) {
        console.log(`  - [${issue.severity}] ${issue.code}: ${issue.message}`);
      }
    }
    if (result.decision.nextStageRecommendation) {
      console.log("nextStageRecommendation:");
      console.log(JSON.stringify(result.decision.nextStageRecommendation, null, 2));
    }
  }
  if (result.usage) {
    console.log(
      `usage input=${String(result.usage.inputTokens)} output=${String(result.usage.outputTokens)} total=${String(result.usage.totalTokens)}`,
    );
  }
  if (result.reviewRun) {
    console.log(`reviewRunId=${result.reviewRun.reviewRunId}`);
    if (result.reviewRun.safetyOverride) {
      console.log(`safetyOverride=${result.reviewRun.safetyOverride}`);
    }
  }
  if (result.stage) console.log(`stageStatus=${result.stage.status}`);
  if (result.task) console.log(`taskStatus=${result.task.status}`);

  if (result.decision?.decision === "HUMAN_REQUIRED" || result.code === "HUMAN_REQUIRED") {
    console.log("");
    console.log("=== HUMAN ACTION REQUIRED ===");
    console.log(`Reason: ${result.decision?.summary ?? result.message}`);
    if (result.decision?.evidence.length) {
      console.log("Evidence:");
      for (const item of result.decision.evidence) console.log(`  - ${item}`);
    }
    console.log("Pipeline stopped. Do not continue automatically.");
  }

  return result.ok || result.code === "DRY_RUN" || result.code === "STAGE_COMPLETED" || result.code === "CREATE_NEXT_STAGE" || result.code === "RETRY_STAGE"
    ? 0
    : 1;
}

async function cmdReviewerSmoke(args: string[]): Promise<number> {
  const config = getOrchConfig();
  if (config.reviewerProvider === "mock") {
    console.log("Reviewer provider is MOCK. Smoke against OpenAI skipped.");
    return 0;
  }
  if (!config.openaiConfigured) {
    console.error("OPENAI_NOT_CONFIGURED");
    return 1;
  }
  if (!hasFlag(args, "--confirm")) {
    console.log("Run manually: dnx-orch reviewer smoke --confirm");
    return 0;
  }
  const result = await smokeOpenAiReviewer(config.openaiModel);
  console.log(result.ok ? "SMOKE_OK" : "SMOKE_FAILED");
  console.log(result.message);
  return result.ok ? 0 : 1;
}

async function cmdAutonomousRun(args: string[], cwd: string): Promise<number> {
  const taskId = args.find((a) => !a.startsWith("--"));
  if (!taskId) {
    console.error("Usage: dnx-orch run <taskId> [--prepare] [--confirm-write] [--dry-run] [--verbose]");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const repoRoot = await resolveRepoRoot(cwd);
  const runner = new AutonomousTaskRunner(store, config);
  const result = await runner.run(taskId, {
    controlPlaneRoot: repoRoot,
    prepare: hasFlag(args, "--prepare"),
    confirmWrite: hasFlag(args, "--confirm-write"),
    dryRun: hasFlag(args, "--dry-run"),
    verbose: hasFlag(args, "--verbose"),
    skipValidationExec: config.cursorProvider === "mock",
  });
  console.log(`code=${result.code}`);
  console.log(`ok=${result.ok}`);
  console.log(`stopReason=${result.stopReason ?? "n/a"}`);
  console.log(`message=${result.message}`);
  if (result.taskRun) console.log(`taskRunId=${result.taskRun.runId}`);
  return result.ok || result.code === "SIMULATE" || result.code === "ALREADY_COMPLETED" ? 0 : 1;
}

async function cmdResume(args: string[], cwd: string): Promise<number> {
  const taskId = args.find((a) => !a.startsWith("--"));
  if (!taskId) {
    console.error("Usage: dnx-orch resume <taskId> [--confirm-write] [--verbose]");
    return 1;
  }
  // Resume = continue autonomous run from persisted state
  return cmdAutonomousRun(
    [taskId, ...args.filter((a) => a.startsWith("--")), "--prepare"],
    cwd,
  );
}

async function cmdTaskCancel(taskId: string | undefined): Promise<number> {
  if (!taskId) {
    console.error("Usage: dnx-orch task cancel <taskId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const result = await cancelTask(store, taskId);
  console.log(result.message);
  if (result.task) console.log(`status=${result.task.status}`);
  return result.ok ? 0 : 1;
}

async function cmdTaskRunShow(runId: string | undefined): Promise<number> {
  if (!runId) {
    console.error("Usage: dnx-orch task-run show <runId>");
    return 1;
  }
  const config = getOrchConfig();
  const store = new JsonTaskStore(config.dataDir);
  const run = await store.getTaskRun(runId);
  if (!run) {
    console.error(`TaskRun not found: ${runId}`);
    return 1;
  }
  console.log(JSON.stringify(run, null, 2));
  const events = await store.listRunEvents(runId);
  if (events.length) {
    console.log("");
    console.log("=== EVENTS ===");
    for (const event of events) {
      console.log(`[${event.timestamp}] ${event.type}: ${event.message}`);
    }
  }
  return 0;
}

export async function runCli(argv: string[], cwd = process.cwd()): Promise<number> {
  resetOrchConfigCache();
  const args = argv.slice(2).filter((arg) => arg !== "--");
  const command = args[0] ?? "help";

  try {
    switch (command) {
      case "help":
      case "--help":
      case "-h":
        printHelp();
        return 0;
      case "doctor":
        return await cmdDoctor(cwd);
      case "status":
        return await cmdStatus();
      case "safety":
        return await cmdSafety();
      case "cursor": {
        if (args[1] === "status") return await cmdCursorStatus();
        console.error("Unknown cursor subcommand. Use: status");
        return 1;
      }
      case "plan":
        return await cmdPlan(args.slice(1));
      case "review":
        return await cmdReview(args.slice(1));
      case "resume":
        return await cmdResume(args.slice(1), cwd);
      case "planner": {
        if (args[1] === "smoke") return await cmdPlannerSmoke(args.slice(2));
        console.error("Unknown planner subcommand. Use: smoke [--confirm]");
        return 1;
      }
      case "reviewer": {
        if (args[1] === "smoke") return await cmdReviewerSmoke(args.slice(2));
        console.error("Unknown reviewer subcommand. Use: smoke [--confirm]");
        return 1;
      }
      case "task": {
        const sub = args[1];
        if (sub === "create") return await cmdTaskCreate(args.slice(2));
        if (sub === "show") return await cmdTaskShow(args[2]);
        if (sub === "prepare") return await cmdTaskPrepare(args.slice(2), cwd);
        if (sub === "worktree") return await cmdTaskWorktree(args[2], cwd);
        if (sub === "cancel") return await cmdTaskCancel(args[2]);
        console.error("Unknown task subcommand. Use: create | show | prepare | worktree | cancel");
        return 1;
      }
      case "task-run": {
        if (args[1] === "show") return await cmdTaskRunShow(args[2]);
        console.error("Unknown task-run subcommand. Use: show");
        return 1;
      }
      case "stage": {
        const sub = args[1];
        if (sub === "inspect") return await cmdStageInspect(args[2], cwd);
        if (sub === "execute") return await cmdStageExecute(args.slice(2), cwd);
        console.error("Unknown stage subcommand. Use: inspect | execute");
        return 1;
      }
      case "run": {
        const sub = args[1];
        if (sub === "show") return await cmdRunShow(args[2]);
        if (sub === "list") return await cmdRunList(args.slice(2));
        if (sub === "resume") return await cmdResume(args.slice(2), cwd);
        return await cmdAutonomousRun(args.slice(1), cwd);
      }
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("cli_error", message);
    console.error(message);
    return 1;
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
const isDirect = invoked === thisFile || invoked.endsWith("/src/cli/index.ts");

if (isDirect) {
  void runCli(process.argv).then((code) => {
    process.exit(code);
  });
}
