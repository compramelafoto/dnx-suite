import type { ReleaseReadiness, RiskLevel } from "../types/index.js";
import { releaseReadinessSchema } from "../types/index.js";
import type { GitCompareService } from "../services/compare.service.js";
import type { GitSecurityService } from "../services/security.service.js";
import type { GitStatusService } from "../services/status.service.js";

export class GitReleaseHelpers {
  constructor(
    private readonly status: GitStatusService,
    private readonly compare: GitCompareService,
    private readonly security: GitSecurityService,
    private readonly defaultBranch?: string,
  ) {}

  async assessReleaseReadiness(): Promise<ReleaseReadiness> {
    const [
      branch,
      dirtyTree,
      unpushedCommits,
      changedFiles,
      lastCommit,
      latestTag,
      aheadBehind,
      summary,
    ] = await Promise.all([
      this.status.getCurrentBranch(),
      this.status.isDirty(),
      this.security.getUnpushedCommitCount(),
      this.compare.getWorkingTreeChangedFiles(),
      this.status.getHeadCommit(),
      this.status.getLatestTag(),
      this.security.isAheadBehindRemote(),
      this.security.getReleaseSummary(this.defaultBranch),
    ]);

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (dirtyTree) {
      blockers.push("Hay cambios sin commitear en el working tree");
    }

    if (unpushedCommits > 0) {
      blockers.push(`${String(unpushedCommits)} commit(s) local(es) sin push al remoto`);
    }

    if (aheadBehind && aheadBehind.behind > 0) {
      blockers.push(
        `La rama está ${String(aheadBehind.behind)} commit(s) detrás del remoto — sincronizar antes del release`,
      );
    }

    if (summary.defaultBranch && branch !== summary.defaultBranch) {
      warnings.push(
        `Rama actual "${branch}" difiere de la rama por defecto "${summary.defaultBranch}"`,
      );
    }

    if (!aheadBehind) {
      warnings.push("No hay upstream configurado para la rama actual");
    }

    if (changedFiles.length > 20) {
      warnings.push(
        `${String(changedFiles.length)} archivos con cambios — revisar alcance del release`,
      );
    }

    const riskLevel = calculateRiskLevel(blockers, warnings);
    const recommendation = buildRecommendation(blockers, warnings, riskLevel);

    return releaseReadinessSchema.parse({
      branch,
      dirtyTree,
      unpushedCommits,
      changedFiles,
      lastCommit,
      latestTag,
      riskLevel,
      blockers,
      warnings,
      recommendation,
    });
  }
}

function calculateRiskLevel(blockers: string[], warnings: string[]): RiskLevel {
  if (blockers.length > 0) {
    return "high";
  }
  if (warnings.length > 0) {
    return "medium";
  }
  return "low";
}

function buildRecommendation(blockers: string[], warnings: string[], riskLevel: RiskLevel): string {
  if (blockers.length > 0) {
    return `No liberar hasta resolver: ${blockers.join("; ")}`;
  }
  if (warnings.length > 0) {
    return `Proceder con precaución: ${warnings.join("; ")}`;
  }
  if (riskLevel === "low") {
    return "Repositorio listo para continuar con el pipeline de release";
  }
  return "Revisar estado del repositorio antes de continuar";
}
