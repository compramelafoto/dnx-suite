import { spawn } from "node:child_process";
import type { OrchConfig } from "../config/env.js";
import {
  classifyProposedValidationCommand,
  isSafePackageName,
  mapSafeValidationAction,
  type SafeValidationAction,
} from "../agents/reviewer/validation-catalog.js";
import type { JsonTaskStore } from "../state/store.js";
import type { ValidationRunRecord } from "../state/types.js";
import { truncateOutput } from "../runtime/truncate.js";

export type ValidationRunnerResult = {
  runs: ValidationRunRecord[];
  allPassed: boolean;
  unverified: string[];
};

const FILTER_RE = /--filter\s+([@a-zA-Z0-9._/-]+)/;

/**
 * Map planner-proposed command strings to typed catalog actions when recognizable.
 * Never execute raw strings.
 */
export function proposeSafeActionsFromCommands(commands: string[]): {
  actions: SafeValidationAction[];
  unverified: string[];
} {
  const actions: SafeValidationAction[] = [];
  const unverified: string[] = [];

  for (const command of commands) {
    const classified = classifyProposedValidationCommand(command);
    const normalized = command.trim().toLowerCase();
    const filterMatch = command.match(FILTER_RE);
    const pkg = filterMatch?.[1];

    if (normalized.includes("typecheck") && pkg && isSafePackageName(pkg)) {
      actions.push({ type: "TYPECHECK_PACKAGE", package: pkg });
      continue;
    }
    if ((normalized.includes(" test") || normalized.endsWith(" test") || normalized.includes("pnpm test")) && pkg && isSafePackageName(pkg)) {
      actions.push({ type: "TEST_PACKAGE", package: pkg });
      continue;
    }
    if (normalized.includes("lint") && pkg && isSafePackageName(pkg)) {
      actions.push({ type: "LINT_PACKAGE", package: pkg });
      continue;
    }
    if (normalized === "git status" || normalized === "git status --porcelain") {
      actions.push({ type: "GIT_STATUS" });
      continue;
    }
    if (normalized === "git diff --stat") {
      actions.push({ type: "GIT_DIFF_STAT" });
      continue;
    }

    if (classified.looksFamiliar) {
      unverified.push(command);
    } else {
      unverified.push(command);
    }
  }

  return { actions, unverified };
}

function runArgv(
  argv: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; durationMs: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const [bin, ...args] = argv;
    if (!bin) {
      resolve({ exitCode: 1, stdout: "", stderr: "empty argv", timedOut: false, durationMs: 0 });
      return;
    }

    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? null : code,
        stdout: truncateOutput(stdout, 20_000).text,
        stderr: truncateOutput(stderr, 10_000).text,
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
}

export type RunSafeValidationsOptions = {
  /** When true, do not spawn — record BLOCKED/skipped for tests. */
  dryRun?: boolean;
  /** Inject executor for unit tests. */
  execFn?: typeof runArgv;
};

export async function runSafeValidations(options: {
  store: JsonTaskStore;
  config: OrchConfig;
  taskId: string;
  stageId: string;
  cursorRunId?: string;
  workspace: string;
  proposedCommands: string[];
  extraActions?: SafeValidationAction[];
  dryRun?: boolean;
  execFn?: typeof runArgv;
}): Promise<ValidationRunnerResult> {
  const { actions, unverified } = proposeSafeActionsFromCommands(options.proposedCommands);
  const allActions = [...actions, ...(options.extraActions ?? [])];
  // Always observe git status when workspace known
  if (!allActions.some((a) => a.type === "GIT_STATUS")) {
    allActions.push({ type: "GIT_STATUS" });
  }

  const runs: ValidationRunRecord[] = [];
  let allPassed = true;
  const exec = options.execFn ?? runArgv;

  for (const action of allActions) {
    const mapped = mapSafeValidationAction(action);
    if (!mapped) {
      allPassed = false;
      const blocked = await options.store.saveValidationRun({
        taskId: options.taskId,
        stageId: options.stageId,
        cursorRunId: options.cursorRunId,
        commandType: action.type,
        commandDisplay: `INVALID:${action.type}`,
        status: "BLOCKED",
        evidenceType: "VERIFIED_BY_ORCHESTRATOR",
        stderr: "Invalid package or action mapping",
      });
      runs.push(blocked);
      continue;
    }

    if (options.dryRun) {
      const skipped = await options.store.saveValidationRun({
        taskId: options.taskId,
        stageId: options.stageId,
        cursorRunId: options.cursorRunId,
        commandType: action.type,
        commandDisplay: mapped.commandDisplay,
        status: "PASSED",
        exitCode: 0,
        stdout: "DRY_RUN_SKIPPED",
        evidenceType: "VERIFIED_BY_ORCHESTRATOR",
        durationMs: 0,
      });
      runs.push(skipped);
      continue;
    }

    const result = await exec(mapped.argv, options.workspace, options.config.validationTimeoutMs);
    const status = result.timedOut
      ? "TIMED_OUT"
      : result.exitCode === 0
        ? "PASSED"
        : "FAILED";
    if (status !== "PASSED") allPassed = false;

    const saved = await options.store.saveValidationRun({
      taskId: options.taskId,
      stageId: options.stageId,
      cursorRunId: options.cursorRunId,
      commandType: action.type,
      commandDisplay: mapped.commandDisplay,
      status,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      evidenceType: "VERIFIED_BY_ORCHESTRATOR",
    });
    runs.push(saved);
  }

  return { runs, allPassed, unverified };
}
