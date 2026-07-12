import { describe, expect, it } from "vitest";
import { DnxBrain } from "../../brain/index.js";
import { InconsistencyDetector } from "../../brain/risk-engine/inconsistency-detector.js";
import { comprameLaFotoPlatform } from "../../platforms/platforms/compramelafoto.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import {
  applyStagingDryRunBrainPolicy,
  buildReleaseBrainSignals,
  evaluateReleaseBrain,
} from "./release-brain.js";
import { buildChecklist, buildRisks } from "./release-checklist.js";
import { normalizeVercelStatusSnapshot } from "./release-vercel-status.js";

const stagingGit: GitReleaseReadiness = {
  branch: "migration-legacy-clf-to-monorepo",
  dirtyTree: false,
  unpushedCommits: 0,
  changedFiles: [],
  lastCommit: {
    hash: "abc123",
    shortHash: "abc12",
    author: "Dev",
    date: "2026-01-01T00:00:00Z",
    subject: "feat",
  },
  latestTag: null,
  riskLevel: "low",
  blockers: [],
  warnings: ["Sin upstream en rama de staging (no bloqueante)"],
  recommendation: "ok",
};

const envMismatchIssues = Array.from({ length: 10 }, (_, index) => ({
  type: "value_mismatch" as const,
  key: `VAR_${String(index)}`,
  message: `Variable "VAR_${String(index)}" difiere entre preview y production`,
}));

const projectsArrayStatus = {
  authenticatedUser: { id: "u1", email: "a@b.com" },
  team: { id: "t1", slug: "team", name: "Team" },
  projects: [
    {
      id: "p1",
      name: "compramelafoto-dnxsuite",
      framework: "nextjs",
      production: { id: "dpl_prod" },
      preview: { id: "dpl_prev" },
      domains: [{ name: "app.vercel.app", verified: true }],
      aliases: ["app.vercel.app"],
      lastDeploy: { id: "dpl_prev" },
      status: "READY",
      health: "healthy",
    },
  ],
  summary: { totalProjects: 1, healthy: 1, building: 0, failed: 0 },
};

const stagingWithEnvDiffs = {
  project: { id: "p1", name: "compramelafoto-dnxsuite", framework: "nextjs", verified: true },
  deployments: { preview: { id: "dpl_prev" }, production: { id: "dpl_prod" } },
  environment: {
    differences: { onlyInPreview: [], onlyInProduction: [], changed: ["DATABASE_URL"], equal: [] },
    issues: envMismatchIssues,
  },
  domains: {
    preview: [{ name: "app.vercel.app", verified: true }],
    production: [{ name: "app.com", verified: true }],
    diff: { previewOnly: [], productionOnly: ["app.com"], unverified: [] },
  },
  aliases: ["app.vercel.app"],
  stagingReady: false,
  recommendations: ["Revisar env"],
};

describe("normalizeVercelStatusSnapshot", () => {
  it("mapea projects[] al proyecto coincidente en status.project", () => {
    const normalized = normalizeVercelStatusSnapshot(
      projectsArrayStatus,
      "compramelafoto-dnxsuite",
    ) as { project?: { name: string; health: string } };

    expect(normalized.project?.name).toBe("compramelafoto-dnxsuite");
    expect(normalized.project?.health).toBe("healthy");
  });
});

describe("buildRisks con projects[]", () => {
  it("no genera riesgo de proyecto no encontrado cuando el proyecto está healthy", () => {
    const risks = buildRisks(projectsArrayStatus, stagingWithEnvDiffs);

    expect(risks.some((r) => r.message.includes("Proyecto no encontrado"))).toBe(false);
    expect(risks.some((r) => r.level === "high")).toBe(false);
  });
});

describe("env diff preview vs production", () => {
  it("no dispara go-with-issues crítico en InconsistencyDetector", () => {
    const detector = new InconsistencyDetector();
    const signals = buildReleaseBrainSignals({
      operation: "release.validate",
      platform: comprameLaFotoPlatform,
      dryRun: false,
      phase: "validating",
      status: projectsArrayStatus,
      staging: stagingWithEnvDiffs,
      validation: { passed: true, issues: [] },
      risks: buildRisks(projectsArrayStatus, stagingWithEnvDiffs),
      checklist: buildChecklist(
        projectsArrayStatus,
        stagingWithEnvDiffs,
        buildRisks(projectsArrayStatus, stagingWithEnvDiffs),
      ),
      issues: [],
      validationDecision: "GO",
      gitReadiness: stagingGit,
    });

    const result = detector.detect(
      {
        operation: "release.validate",
        platformId: "compramelafoto",
        platformName: "ComprameLaFoto",
        dryRun: false,
      },
      signals,
    );

    expect(result.inconsistencies.some((i) => i.id === "go-with-issues")).toBe(false);
    expect(signals.some((s) => s.key === "staging.env.issues.count" && s.value === 10)).toBe(true);
    expect(signals.some((s) => s.key === "validation.issues.count" && s.value === 0)).toBe(true);
  });
});

describe("release_validate real — Brain no bloqueante", () => {
  it("con Vercel passed, providers OK y warnings staging no fuerza score 0 ni bloqueo", () => {
    const risks = buildRisks(projectsArrayStatus, stagingWithEnvDiffs);
    const checklist = buildChecklist(projectsArrayStatus, stagingWithEnvDiffs, risks);
    const rawBrain = evaluateReleaseBrain(new DnxBrain(), {
      operation: "release.validate",
      platform: comprameLaFotoPlatform,
      dryRun: false,
      phase: "validating",
      status: projectsArrayStatus,
      staging: stagingWithEnvDiffs,
      validation: { passed: true, issues: [] },
      risks,
      checklist,
      issues: [],
      validationDecision: "GO",
      gitReadiness: stagingGit,
      prismaReadiness: {
        schemaValid: true,
        schemaPath: "schema",
        schemaHash: "x",
        migrationCount: 6,
        latestMigration: "m",
        pendingMigrations: [],
        driftRisk: {
          level: "low",
          reasons: [],
          pendingMigrations: false,
          schemaInvalid: false,
          formatDrift: false,
        },
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
      postgresReadiness: {
        connected: true,
        version: "17",
        databaseSize: 1,
        activeConnections: 1,
        longRunningQueries: [],
        locks: [],
        migrationTableExists: true,
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
      gitPolicyContext: { dryRun: false, target: "preview" },
    });

    const brain = applyStagingDryRunBrainPolicy(rawBrain, {
      operation: "release.validate",
      platform: comprameLaFotoPlatform,
      dryRun: false,
      validationPassed: true,
      gitPolicyContext: { dryRun: false, target: "preview" },
      gitReadiness: stagingGit,
      prismaReadiness: {
        schemaValid: true,
        schemaPath: "schema",
        schemaHash: "x",
        migrationCount: 6,
        latestMigration: "m",
        pendingMigrations: [],
        driftRisk: {
          level: "low",
          reasons: [],
          pendingMigrations: false,
          schemaInvalid: false,
          formatDrift: false,
        },
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
      postgresReadiness: {
        connected: true,
        version: "17",
        databaseSize: 1,
        activeConnections: 1,
        longRunningQueries: [],
        locks: [],
        migrationTableExists: true,
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
    });

    expect(rawBrain.score).toBeGreaterThan(0);
    expect(brain.shouldBlock).toBe(false);
    expect(brain.rejected).toBe(false);
    expect(["approve", "caution"]).toContain(brain.verdict);
  });
});

describe("applyStagingDryRunBrainPolicy", () => {
  const baseBrain = {
    score: 65,
    confidence: 0.95,
    verdict: "reject" as const,
    reasoning: ["test"],
    recommendation: "reject",
    nextActions: [],
    risks: [],
    inconsistencies: [],
    rejected: true,
    shouldBlock: true,
  };

  it("no bloquea validate dry-run con rama permitida en staging", () => {
    const result = applyStagingDryRunBrainPolicy(baseBrain, {
      operation: "release.validate",
      platform: comprameLaFotoPlatform,
      dryRun: true,
      gitPolicyContext: { dryRun: true, target: "preview" },
      gitReadiness: stagingGit,
      prismaReadiness: {
        schemaValid: true,
        schemaPath: "schema",
        schemaHash: "x",
        migrationCount: 6,
        latestMigration: "m",
        pendingMigrations: [],
        driftRisk: {
          level: "low",
          reasons: [],
          pendingMigrations: false,
          schemaInvalid: false,
          formatDrift: false,
        },
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
      postgresReadiness: {
        connected: true,
        version: "17",
        databaseSize: 1,
        activeConnections: 1,
        longRunningQueries: [],
        locks: [],
        migrationTableExists: true,
        riskLevel: "low",
        blockers: [],
        warnings: [],
        recommendation: "ok",
      },
    });

    expect(result.shouldBlock).toBe(false);
    expect(result.verdict).toBe("caution");
  });

  it("no bloquea validate real cuando validationPassed y providers OK", () => {
    const result = applyStagingDryRunBrainPolicy(baseBrain, {
      operation: "release.validate",
      platform: comprameLaFotoPlatform,
      dryRun: false,
      validationPassed: true,
      gitPolicyContext: { dryRun: false, target: "preview" },
      gitReadiness: stagingGit,
    });

    expect(result.shouldBlock).toBe(false);
    expect(result.rejected).toBe(false);
  });
});
