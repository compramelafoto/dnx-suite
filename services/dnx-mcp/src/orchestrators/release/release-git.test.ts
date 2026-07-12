import { describe, expect, it } from "vitest";
import { comprameLaFotoPlatform } from "../../platforms/platforms/compramelafoto.js";
import { fotorankPlatform } from "../../platforms/index.js";
import type { ReleaseReadiness } from "../../providers/git/types/index.js";
import {
  applyPlatformGitPolicy,
  assertGitAllowsReleaseExecution,
  gitHasCriticalBlockers,
  GitReleaseBlockedError,
  softenStagingGitWarnings,
} from "./release-git.js";

const baseReadiness: ReleaseReadiness = {
  branch: "main",
  dirtyTree: false,
  unpushedCommits: 0,
  changedFiles: [],
  lastCommit: {
    hash: "abc123",
    shortHash: "abc12",
    author: "Dev",
    date: "2026-01-01T00:00:00Z",
    subject: "feat: ok",
  },
  latestTag: "v1.0.0",
  riskLevel: "low",
  blockers: [],
  warnings: [],
  recommendation: "Repositorio listo",
};

const stagingBranchWarnings: ReleaseReadiness = {
  ...baseReadiness,
  branch: "migration-legacy-clf-to-monorepo",
  riskLevel: "medium",
  warnings: [
    'Rama actual "migration-legacy-clf-to-monorepo" difiere de la rama por defecto "main"',
    "No hay upstream configurado para la rama actual",
  ],
  recommendation: "Proceder con precaución",
};

const stagingContext = { dryRun: true, target: "preview" as const };

describe("release-git", () => {
  it("agrega blocker por rama no permitida", () => {
    const result = applyPlatformGitPolicy(
      { ...baseReadiness, branch: "feature/x" },
      fotorankPlatform,
      stagingContext,
    );

    expect(result.blockers.some((b) => b.includes("no permitida"))).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("rama permitida en staging no bloquea y baja riesgo", () => {
    const result = applyPlatformGitPolicy(
      stagingBranchWarnings,
      comprameLaFotoPlatform,
      stagingContext,
    );

    expect(result.blockers).toEqual([]);
    expect(result.riskLevel).toBe("low");
    expect(result.warnings.some((w) => w.includes("permitida para staging"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("no bloqueante"))).toBe(true);
  });

  it("rama no permitida en staging bloquea", () => {
    const result = applyPlatformGitPolicy(
      { ...stagingBranchWarnings, branch: "feature/experimental" },
      comprameLaFotoPlatform,
      stagingContext,
    );

    expect(result.blockers.some((b) => b.includes("no permitida"))).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("producción en rama no-main bloquea en assert", () => {
    expect(() => {
      assertGitAllowsReleaseExecution(
        {
          ...stagingBranchWarnings,
          riskLevel: "low",
          warnings: [],
          recommendation: "ok",
        },
        comprameLaFotoPlatform,
        { dryRun: false, target: "production" },
      );
    }).toThrow(GitReleaseBlockedError);
  });

  it("sin upstream en staging dryRun es warning suave, no bloqueo", () => {
    const softened = softenStagingGitWarnings(stagingBranchWarnings, comprameLaFotoPlatform);

    expect(softened.blockers).toEqual([]);
    expect(softened.riskLevel).toBe("low");
    expect(gitHasCriticalBlockers(softened)).toBe(false);
  });

  it("detecta bloqueos críticos", () => {
    expect(gitHasCriticalBlockers(baseReadiness)).toBe(false);
    expect(gitHasCriticalBlockers({ ...baseReadiness, riskLevel: "high" })).toBe(true);
  });

  it("assertGitAllowsReleaseExecution lanza con dirty tree", () => {
    expect(() => {
      assertGitAllowsReleaseExecution({ ...baseReadiness, dirtyTree: true }, fotorankPlatform);
    }).toThrow(GitReleaseBlockedError);
  });
});
