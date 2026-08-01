import type { OrchConfig } from "../config/env.js";
import type { CursorRunRecord, Stage, Task } from "../state/types.js";

const SECRET_PATH_PATTERNS = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.env\.[a-z0-9_-]+$/i,
  /(^|\/)credentials(\.|\/|$)/i,
  /(^|\/)secrets?(\.|\/|$)/i,
  /(^|\/).*service-account.*\.json$/i,
  /(^|\/).*private[_-]?key.*/i,
  /(^|\/)id_rsa$/i,
];

const PROD_INFRA_PATTERNS = [
  /vercel\.json$/i,
  /cloudflare/i,
  /terraform\//i,
  /\.tf$/i,
  /deploy.*prod/i,
  /production\.(ya?ml|json|toml)$/i,
];

export type GuardFinding = {
  code: string;
  severity: "WARNING" | "HUMAN_REQUIRED" | "BLOCKED";
  message: string;
};

export function parseNumstat(numstat: string): { added: number; deleted: number } {
  let added = 0;
  let deleted = 0;
  for (const line of numstat.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const a = parts[0] === "-" ? 0 : Number(parts[0]);
    const d = parts[1] === "-" ? 0 : Number(parts[1]);
    if (Number.isFinite(a)) added += a;
    if (Number.isFinite(d)) deleted += d;
  }
  return { added, deleted };
}

export function evaluateDiffGuards(options: {
  config: OrchConfig;
  stageFilesChanged: string[];
  taskFilesChanged: string[];
  numstatText?: string;
}): GuardFinding[] {
  const findings: GuardFinding[] = [];
  const stageCount = options.stageFilesChanged.length;
  const taskCount = new Set(options.taskFilesChanged).size;

  if (stageCount > options.config.maxFilesChangedPerStage) {
    findings.push({
      code: "DIFF_FILES_PER_STAGE",
      severity: "HUMAN_REQUIRED",
      message: `Stage changed ${stageCount} files > limit ${options.config.maxFilesChangedPerStage}`,
    });
  }

  if (taskCount > options.config.maxTotalFilesChangedPerTask) {
    findings.push({
      code: "DIFF_FILES_PER_TASK",
      severity: "HUMAN_REQUIRED",
      message: `Task changed ${taskCount} unique files > limit ${options.config.maxTotalFilesChangedPerTask}`,
    });
  }

  if (options.numstatText) {
    const { added, deleted } = parseNumstat(options.numstatText);
    const total = added + deleted;
    if (total > options.config.maxChangedLinesPerStage) {
      findings.push({
        code: "DIFF_LINES_PER_STAGE",
        severity: "HUMAN_REQUIRED",
        message: `Stage changed ${total} lines > limit ${options.config.maxChangedLinesPerStage}`,
      });
    }
  }

  return findings;
}

export function evaluateScopeGuards(options: {
  task: Task;
  stage: Stage;
  filesChanged: string[];
}): GuardFinding[] {
  const findings: GuardFinding[] = [];

  for (const file of options.filesChanged) {
    if (SECRET_PATH_PATTERNS.some((re) => re.test(file))) {
      findings.push({
        code: "SECRET_FILE_TOUCHED",
        severity: "BLOCKED",
        message: `Secret/credential path touched: ${file}`,
      });
    }
    if (PROD_INFRA_PATTERNS.some((re) => re.test(file))) {
      findings.push({
        code: "PROD_INFRA_TOUCHED",
        severity: "BLOCKED",
        message: `Production/infra path touched: ${file}`,
      });
    }
  }

  const apps = new Set<string>();
  for (const file of options.filesChanged) {
    const m = file.match(/^apps\/([^/]+)\//);
    if (m?.[1]) apps.add(m[1]);
  }
  const projectHint = options.task.project.toLowerCase();
  if (apps.size >= 3 || (apps.size >= 2 && !apps.has(projectHint) && projectHint !== "dnx-suite")) {
    findings.push({
      code: "SCOPE_EXPANSION",
      severity: "HUMAN_REQUIRED",
      message: `Stage touched multiple apps: ${[...apps].join(", ")}`,
    });
  }

  return findings;
}

export function evaluatePostCursorGuards(options: {
  config: OrchConfig;
  task: Task;
  stage: Stage;
  cursorRun: CursorRunRecord;
  allTaskFilesChanged: string[];
  numstatText?: string;
}): GuardFinding[] {
  const files = options.cursorRun.filesChanged ?? [];
  return [
    ...evaluateDiffGuards({
      config: options.config,
      stageFilesChanged: files,
      taskFilesChanged: options.allTaskFilesChanged,
      numstatText: options.numstatText ?? options.cursorRun.gitDiffStat,
    }),
    ...evaluateScopeGuards({
      task: options.task,
      stage: options.stage,
      filesChanged: files,
    }),
  ];
}

export function buildProgressFingerprint(parts: {
  decision?: string | null;
  title?: string;
  objective?: string;
  issues?: string[];
  filesChanged?: string[];
}): string {
  return [
    parts.decision ?? "",
    parts.title ?? "",
    parts.objective ?? "",
    (parts.issues ?? []).slice().sort().join("|"),
    (parts.filesChanged ?? []).slice().sort().join("|"),
  ].join("::");
}
