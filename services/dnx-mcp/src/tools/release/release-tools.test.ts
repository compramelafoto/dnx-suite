import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReleaseOrchestrator } from "../../orchestrators/release/index.js";
import { fotorankPlatform } from "../../platforms/index.js";
import { resetReleaseToolContext } from "./context.js";
import { handleReleaseExecute } from "./release-execute.js";
import { handleReleasePrepare } from "./release-prepare.js";
import { handleReleaseRollback } from "./release-rollback.js";
import { handleReleaseValidate } from "./release-validate.js";
import {
  releaseExecuteInputSchema,
  releasePrepareInputSchema,
  releaseRollbackInputSchema,
  releaseValidateInputSchema,
} from "./schemas.js";

const mockBrain = {
  score: 85,
  confidence: 0.9,
  verdict: "approve" as const,
  reasoning: ["OK"],
  recommendation: "Proceder",
  nextActions: [],
  risks: [],
  inconsistencies: [],
  rejected: false,
  shouldBlock: false,
};

const mockPrepareResult = {
  phase: "prepared" as const,
  platformId: "fotorank",
  platformName: "FotoRank",
  vercelProject: "fotorank",
  dryRun: true,
  status: { project: { health: "healthy" } },
  staging: { stagingReady: true },
  risks: [],
  checklist: [],
  plan: {
    platformId: "fotorank",
    platformName: "FotoRank",
    vercelProject: "fotorank",
    candidateTarget: "production" as const,
    steps: [],
    risks: [],
    checklist: [],
    readyForValidation: true,
    generatedAt: "2026-01-01T00:00:00Z",
  },
  brain: mockBrain,
  git: { branch: "main", riskLevel: "low" as const, blockers: [] },
  prisma: { schemaValid: true, riskLevel: "low" as const, blockers: [] },
  postgres: { connected: true, riskLevel: "low" as const, blockers: [] },
  metrics: { totalDurationMs: 10, steps: [] },
  report: {},
};

const mockValidateResult = {
  phase: "validated" as const,
  platformId: "fotorank",
  platformName: "FotoRank",
  vercelProject: "fotorank",
  dryRun: true,
  decision: "GO" as const,
  validation: { passed: true },
  issues: [],
  brain: mockBrain,
  git: mockPrepareResult.git,
  prisma: mockPrepareResult.prisma,
  postgres: mockPrepareResult.postgres,
  metrics: { totalDurationMs: 10, steps: [] },
  report: {},
};

function createMockOrchestrator() {
  const prepareRelease = vi.fn().mockResolvedValue(mockPrepareResult);
  const validateRelease = vi.fn().mockResolvedValue(mockValidateResult);
  const executeRelease = vi.fn().mockResolvedValue({
    phase: "validated",
    platformId: "fotorank",
    platformName: "FotoRank",
    vercelProject: "fotorank",
    dryRun: true,
    executed: true,
    deployment: { success: true, id: "dpl_sim" },
    brain: mockBrain,
    git: mockPrepareResult.git,
    prisma: mockPrepareResult.prisma,
    postgres: mockPrepareResult.postgres,
    report: {},
    metrics: { totalDurationMs: 5, steps: [] },
  });
  const rollbackRelease = vi.fn().mockResolvedValue({
    phase: "validated",
    platformId: "fotorank",
    platformName: "FotoRank",
    vercelProject: "fotorank",
    dryRun: true,
    executed: true,
    report: { success: true },
    metrics: { totalDurationMs: 5, steps: [] },
  });

  return {
    orchestrator: {
      prepareRelease,
      validateRelease,
      executeRelease,
      rollbackRelease,
    } as unknown as ReleaseOrchestrator,
    prepareRelease,
    validateRelease,
    executeRelease,
    rollbackRelease,
  };
}

describe("release MCP tools — schemas", () => {
  it("defaults dryRun=true y confirm=false", () => {
    expect(releasePrepareInputSchema.parse({ platformId: "fotorank" })).toEqual({
      platformId: "fotorank",
      dryRun: true,
    });
    expect(releaseExecuteInputSchema.parse({ platformId: "fotorank" })).toEqual({
      platformId: "fotorank",
      confirm: false,
      dryRun: true,
    });
  });
});

describe("release MCP tools — handlers", () => {
  beforeEach(() => {
    resetReleaseToolContext();
  });

  it("release_prepare devuelve plan, providers y Brain", async () => {
    const { orchestrator, prepareRelease } = createMockOrchestrator();
    const result = await handleReleasePrepare(
      { platformId: "fotorank", dryRun: true },
      orchestrator,
    );

    expect(prepareRelease).toHaveBeenCalledWith({
      platform: fotorankPlatform,
      dryRun: true,
    });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.platform.id).toBe("fotorank");
    expect(result.plan.readyForValidation).toBe(true);
    expect(result.vercel.status).toBeDefined();
    expect(result.git?.branch).toBe("main");
    expect(result.prisma?.schemaValid).toBe(true);
    expect(result.postgres?.connected).toBe(true);
    expect(result.brain.score).toBe(85);
    expect(result.brain.shouldBlock).toBe(false);
  });

  it("release_validate devuelve GO cuando no hay bloqueos", async () => {
    const { orchestrator } = createMockOrchestrator();
    const result = await handleReleaseValidate(
      { platformId: "fotorank", dryRun: true },
      orchestrator,
    );

    expect(result.decision).toBe("GO");
    expect(result.blocked).toBe(false);
    expect(result.canExecute).toBe(true);
    expect(result.brain.shouldBlock).toBe(false);
  });

  it("release_validate refleja NO-GO cuando Brain bloquea", async () => {
    const { orchestrator, validateRelease } = createMockOrchestrator();
    validateRelease.mockResolvedValue({
      ...mockValidateResult,
      decision: "NO-GO",
      brain: {
        ...mockBrain,
        shouldBlock: true,
        verdict: "reject",
        recommendation: "PostgreSQL bloquea release",
      },
    });

    const result = await handleReleaseValidate(
      { platformId: "fotorank", dryRun: true },
      orchestrator,
    );

    expect(result.decision).toBe("NO-GO");
    expect(result.blocked).toBe(true);
    expect(result.canExecute).toBe(false);
  });

  it("release_execute en dryRun simula sin confirm", async () => {
    const { orchestrator, executeRelease } = createMockOrchestrator();
    const result = await handleReleaseExecute(
      { platformId: "fotorank", dryRun: true, confirm: false },
      orchestrator,
    );

    expect(executeRelease).toHaveBeenCalledWith({
      platform: fotorankPlatform,
      dryRun: true,
      confirm: false,
      target: "production",
    });
    expect(result.executed).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("release_execute sin confirm ni dryRun no ejecuta", async () => {
    const { orchestrator, executeRelease } = createMockOrchestrator();
    const result = await handleReleaseExecute(
      { platformId: "fotorank", dryRun: false, confirm: false },
      orchestrator,
    );

    expect(executeRelease).not.toHaveBeenCalled();
    expect(result.executed).toBe(false);
    if ("confirmed" in result) {
      expect(result.confirmed).toBe(false);
    }
    expect(result.summary).toContain("omitida");
  });

  it("release_execute con confirm y sin dryRun delega al orchestrator", async () => {
    const { orchestrator, executeRelease } = createMockOrchestrator();
    await handleReleaseExecute(
      { platformId: "fotorank", dryRun: false, confirm: true },
      orchestrator,
    );

    expect(executeRelease).toHaveBeenCalledWith({
      platform: fotorankPlatform,
      dryRun: false,
      confirm: true,
      target: "production",
    });
  });

  it("release_rollback en dryRun simula por defecto", async () => {
    const { orchestrator, rollbackRelease } = createMockOrchestrator();
    const result = await handleReleaseRollback(
      { platformId: "fotorank", dryRun: true, confirm: false },
      orchestrator,
    );

    expect(rollbackRelease).toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.executed).toBe(true);
  });

  it("release_rollback sin confirm ni dryRun no ejecuta", async () => {
    const { orchestrator, rollbackRelease } = createMockOrchestrator();
    const result = await handleReleaseRollback(
      { platformId: "fotorank", dryRun: false, confirm: false },
      orchestrator,
    );

    expect(rollbackRelease).not.toHaveBeenCalled();
    expect(result.executed).toBe(false);
  });

  it("rechaza platformId desconocido", async () => {
    const { orchestrator } = createMockOrchestrator();

    await expect(
      handleReleasePrepare({ platformId: "no-existe", dryRun: true }, orchestrator),
    ).rejects.toThrow("Plataforma no encontrada");
  });

  it("releaseValidateInputSchema valida platformId", () => {
    expect(() => releaseValidateInputSchema.parse({ platformId: "" })).toThrow();
  });

  it("releaseRollbackInputSchema acepta overrides", () => {
    expect(
      releaseRollbackInputSchema.parse({
        platformId: "fotorank",
        dryRun: false,
        confirm: true,
      }),
    ).toEqual({
      platformId: "fotorank",
      dryRun: false,
      confirm: true,
    });
  });
});
