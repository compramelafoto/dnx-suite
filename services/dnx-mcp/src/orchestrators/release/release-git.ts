import type { BrainSignal, SignalSeverity } from "../../brain/types.js";
import type { PlatformDefinition } from "../../platforms/types.js";
import type { GitProvider } from "../../providers/git/provider.js";
import type { ReleaseReadiness, RiskLevel } from "../../providers/git/types/index.js";

export type ReleaseGitTarget = "production" | "preview" | "development";

export interface ReleaseGitPolicyContext {
  dryRun: boolean;
  target: ReleaseGitTarget;
}

const BRANCH_DIFF_WARNING = /difiere de la rama por defecto/i;
const NO_UPSTREAM_WARNING = /no hay upstream configurado/i;

export function getAllowedReleaseBranches(platform: PlatformDefinition): string[] {
  const fromPolicy = platform.releasePolicy.allowedBranches ?? [];
  if (fromPolicy.length > 0) {
    return fromPolicy;
  }
  return [platform.defaultBranch];
}

export function inferReleaseGitTarget(platform: PlatformDefinition): ReleaseGitTarget {
  const targets = platform.releasePolicy.allowedTargets;
  if (targets.length > 0 && !targets.includes("production")) {
    return "preview";
  }
  return "production";
}

export function isStagingGitPolicyContext(
  platform: PlatformDefinition,
  context: ReleaseGitPolicyContext,
): boolean {
  if (context.dryRun) {
    return true;
  }
  if (context.target === "preview" || context.target === "development") {
    return true;
  }
  const targets = platform.releasePolicy.allowedTargets;
  return targets.length > 0 && !targets.includes("production");
}

function isStagingOnlyGitWarning(warning: string): boolean {
  return BRANCH_DIFF_WARNING.test(warning) || NO_UPSTREAM_WARNING.test(warning);
}

function recalculateGitRiskLevel(blockers: string[], warnings: string[]): RiskLevel {
  if (blockers.length > 0) {
    return "high";
  }
  if (warnings.length > 0) {
    return "medium";
  }
  return "low";
}

export function softenStagingGitWarnings(
  readiness: ReleaseReadiness,
  platform: PlatformDefinition,
): ReleaseReadiness {
  const allowed = getAllowedReleaseBranches(platform);
  if (!allowed.includes(readiness.branch) || readiness.blockers.length > 0) {
    return readiness;
  }

  const onlyStagingWarnings =
    readiness.warnings.length > 0 && readiness.warnings.every(isStagingOnlyGitWarning);

  if (!onlyStagingWarnings && readiness.warnings.length > 0) {
    return readiness;
  }

  const warnings = readiness.warnings.map((warning) => {
    if (BRANCH_DIFF_WARNING.test(warning)) {
      return `Rama "${readiness.branch}" permitida para staging (catalog)`;
    }
    if (NO_UPSTREAM_WARNING.test(warning)) {
      return "Sin upstream en rama de staging (no bloqueante)";
    }
    return warning;
  });

  const riskLevel = recalculateGitRiskLevel(
    readiness.blockers,
    onlyStagingWarnings ? [] : warnings,
  );

  return {
    ...readiness,
    warnings,
    riskLevel,
    recommendation:
      riskLevel === "low" ? "Repositorio listo para staging/preparación" : readiness.recommendation,
  };
}

export function applyPlatformGitPolicy(
  readiness: ReleaseReadiness,
  platform: PlatformDefinition,
  context?: ReleaseGitPolicyContext,
): ReleaseReadiness {
  const allowed = getAllowedReleaseBranches(platform);
  const blockers = [...readiness.blockers];

  if (!allowed.includes(readiness.branch)) {
    blockers.push(
      `Rama "${readiness.branch}" no permitida para release. Permitidas: ${allowed.join(", ")}`,
    );
  }

  if (blockers.length > 0) {
    return {
      ...readiness,
      blockers,
      riskLevel: "high",
      recommendation: `No liberar: rama incorrecta para ${platform.name}`,
    };
  }

  const policyContext = context ?? {
    dryRun: false,
    target: inferReleaseGitTarget(platform),
  };

  if (isStagingGitPolicyContext(platform, policyContext)) {
    return softenStagingGitWarnings(readiness, platform);
  }

  return readiness;
}

export function gitHasCriticalBlockers(readiness: ReleaseReadiness): boolean {
  return readiness.blockers.length > 0 || readiness.riskLevel === "high";
}

export function assertGitAllowsReleaseExecution(
  readiness: ReleaseReadiness,
  platform: PlatformDefinition,
  context?: ReleaseGitPolicyContext,
): void {
  const policyContext = context ?? {
    dryRun: false,
    target: "production" as const,
  };
  const allowed = getAllowedReleaseBranches(platform);
  const blockers: string[] = [];

  if (readiness.dirtyTree) {
    blockers.push("Working tree con cambios sin commitear");
  }
  if (readiness.unpushedCommits > 0) {
    blockers.push(`${String(readiness.unpushedCommits)} commit(s) sin push al remoto`);
  }

  if (policyContext.target === "production" && readiness.branch !== platform.defaultBranch) {
    blockers.push(
      `Producción requiere rama "${platform.defaultBranch}" (actual: "${readiness.branch}")`,
    );
  } else if (!allowed.includes(readiness.branch)) {
    blockers.push(`Rama "${readiness.branch}" no permitida (permitidas: ${allowed.join(", ")})`);
  }

  if (readiness.riskLevel === "high") {
    blockers.push("Git riskLevel alto");
  }

  if (blockers.length > 0) {
    throw new GitReleaseBlockedError(blockers);
  }
}

export class GitReleaseBlockedError extends Error {
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`Release bloqueado por estado Git: ${blockers.join("; ")}`);
    this.name = "GitReleaseBlockedError";
    this.blockers = blockers;
  }
}

function warningSignalSeverity(
  warning: string,
  platform: PlatformDefinition,
  context: ReleaseGitPolicyContext,
  branchAllowed: boolean,
): SignalSeverity {
  if (
    branchAllowed &&
    isStagingGitPolicyContext(platform, context) &&
    (isStagingOnlyGitWarning(warning) ||
      warning.includes("permitida para staging") ||
      warning.includes("no bloqueante"))
  ) {
    return "low";
  }
  return "medium";
}

export function appendGitSignals(
  readiness: ReleaseReadiness,
  platform: PlatformDefinition,
  signals: BrainSignal[],
  context?: ReleaseGitPolicyContext,
): void {
  const policyContext = context ?? {
    dryRun: false,
    target: inferReleaseGitTarget(platform),
  };
  const allowed = getAllowedReleaseBranches(platform);
  const branchAllowed = allowed.includes(readiness.branch);

  signals.push({
    source: "git",
    type: "state",
    key: "git.dirtyTree",
    message: readiness.dirtyTree
      ? "Working tree sucio — hay cambios sin commitear"
      : "Working tree limpio",
    value: readiness.dirtyTree,
    ...(readiness.dirtyTree ? { severity: "critical" as const } : {}),
  });

  signals.push({
    source: "git",
    type: "metric",
    key: "git.unpushedCommits",
    message: `${String(readiness.unpushedCommits)} commit(s) sin push`,
    value: readiness.unpushedCommits,
    ...(readiness.unpushedCommits > 0 ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "git",
    type: "policy",
    key: "git.branch.allowed",
    message: branchAllowed
      ? `Rama "${readiness.branch}" permitida para release`
      : `Rama "${readiness.branch}" no permitida para release`,
    value: branchAllowed,
    ...(!branchAllowed ? { severity: "high" as const } : {}),
  });

  signals.push({
    source: "git",
    type: "state",
    key: "git.branch",
    message: `Rama actual: ${readiness.branch}`,
    value: readiness.branch,
  });

  signals.push({
    source: "git",
    type: "risk",
    key: "git.riskLevel",
    message: `Nivel de riesgo Git: ${readiness.riskLevel}`,
    value: readiness.riskLevel,
    severity:
      readiness.riskLevel === "high" ? "high" : readiness.riskLevel === "medium" ? "medium" : "low",
  });

  for (const blocker of readiness.blockers) {
    signals.push({
      source: "git",
      type: "risk",
      key: "git.blocker",
      message: blocker,
      severity: "high",
    });
  }

  for (const warning of readiness.warnings) {
    signals.push({
      source: "git",
      type: "issue",
      key: "git.warning",
      message: warning,
      severity: warningSignalSeverity(warning, platform, policyContext, branchAllowed),
    });
  }
}

export function formatGitReport(readiness: ReleaseReadiness): Record<string, unknown> {
  return {
    branch: readiness.branch,
    dirtyTree: readiness.dirtyTree,
    unpushedCommits: readiness.unpushedCommits,
    changedFilesCount: readiness.changedFiles.length,
    changedFiles: readiness.changedFiles,
    lastCommit: readiness.lastCommit,
    latestTag: readiness.latestTag,
    riskLevel: readiness.riskLevel,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    recommendation: readiness.recommendation,
  };
}

export type GitProviderResolver = (platform: PlatformDefinition) => GitProvider | undefined;

export function resolveGitProvider(
  platform: PlatformDefinition,
  options: {
    git?: GitProvider | undefined;
    getGitProvider?: GitProviderResolver | undefined;
  },
): GitProvider | undefined {
  return options.getGitProvider?.(platform) ?? options.git;
}
