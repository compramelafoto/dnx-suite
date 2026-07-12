import { describe, expect, it, vi } from "vitest";
import { DnxBrain } from "../../brain/index.js";
import type { BrainEvaluateOptions, BrainInput } from "../../brain/types.js";
import { fotorankPlatform } from "../../platforms/index.js";
import type { GitProvider } from "../../providers/git/provider.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import type { PrismaProvider } from "../../providers/prisma/provider.js";
import type { ReleaseReadiness as PrismaReleaseReadiness } from "../../providers/prisma/types/index.js";
import type { PostgresProvider } from "../../providers/postgres/provider.js";
import type { ReleaseReadiness as PostgresReleaseReadiness } from "../../providers/postgres/types/index.js";
import { ProviderRegistry } from "../../providers/registry/index.js";
import { ReleaseState } from "./release-state.js";
import { buildChecklist, buildRisks, isReadyForValidation } from "./release-checklist.js";
import { ReleaseOrchestrator } from "./release-orchestrator.js";
import type { ReleaseToolName, ToolInvoker } from "./release-types.js";

const testPlatform = {
  ...fotorankPlatform,
  vercelProject: "app",
};

const mockStatus = {
  authenticatedUser: { id: "u1", email: "a@b.com" },
  team: { id: "t1", slug: "team", name: "Team" },
  project: {
    id: "p1",
    name: "app",
    framework: "nextjs",
    production: { id: "dpl_prod" },
    preview: { id: "dpl_prev" },
    domains: [{ name: "app.vercel.app", verified: true }],
    aliases: ["app.vercel.app"],
    lastDeploy: { id: "dpl_prev" },
    status: "READY",
    health: "healthy",
  },
  summary: { totalProjects: 1, healthy: 1, building: 0, failed: 0 },
};

const mockStaging = {
  project: { id: "p1", name: "app", framework: "nextjs", verified: true },
  deployments: { preview: { id: "dpl_prev" }, production: { id: "dpl_prod" } },
  environment: {
    differences: { onlyInPreview: [], onlyInProduction: [], changed: [], equal: ["API_URL"] },
    issues: [],
  },
  domains: {
    preview: [{ name: "app.vercel.app", verified: true }],
    production: [{ name: "app.com", verified: true }],
    diff: { previewOnly: [], productionOnly: ["app.com"], unverified: [] },
  },
  aliases: ["app.vercel.app"],
  stagingReady: true,
  recommendations: ["Staging listo"],
};

const riskyStatus = {
  ...mockStatus,
  project: {
    ...mockStatus.project,
    health: "failed",
  },
};

const riskyStaging = {
  ...mockStaging,
  deployments: { preview: null, production: mockStaging.deployments.production },
  environment: {
    ...mockStaging.environment,
    issues: [
      {
        type: "value_mismatch",
        key: "API_URL",
        message: "Variable difiere entre staging y producción",
      },
    ],
  },
  domains: {
    ...mockStaging.domains,
    diff: { previewOnly: [], productionOnly: ["app.com"], unverified: ["evil.com"] },
  },
  stagingReady: false,
};

const cleanGitReadiness: GitReleaseReadiness = {
  branch: "main",
  dirtyTree: false,
  unpushedCommits: 0,
  changedFiles: [],
  lastCommit: {
    hash: "abc123def456",
    shortHash: "abc123d",
    author: "Dev",
    date: "2026-01-01T00:00:00Z",
    subject: "feat: release",
  },
  latestTag: "v1.1.0",
  riskLevel: "low",
  blockers: [],
  warnings: [],
  recommendation: "Repositorio listo para continuar con el pipeline de release",
};

function createMockGit(overrides: Partial<GitReleaseReadiness> = {}): GitProvider {
  const readiness = { ...cleanGitReadiness, ...overrides };

  return {
    name: "git",
    isConfigured: () => true,
    assessReleaseReadiness: vi.fn().mockResolvedValue(readiness),
  } as unknown as GitProvider;
}

const cleanPrismaReadiness: PrismaReleaseReadiness = {
  schemaValid: true,
  schemaPath: "/app/prisma/schema.prisma",
  schemaHash: "abc123def4567890",
  migrationCount: 5,
  latestMigration: "20240101000000_init",
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
  recommendation: "Estado Prisma listo para continuar con el pipeline de release",
};

function createMockPrisma(overrides: Partial<PrismaReleaseReadiness> = {}): PrismaProvider {
  const readiness = { ...cleanPrismaReadiness, ...overrides };

  return {
    name: "prisma",
    isConfigured: () => true,
    assessReleaseReadiness: vi.fn().mockResolvedValue(readiness),
  } as unknown as PrismaProvider;
}

const cleanPostgresReadiness: PostgresReleaseReadiness = {
  connected: true,
  version: "PostgreSQL 16.2",
  databaseSize: 1_048_576,
  activeConnections: 5,
  longRunningQueries: [],
  locks: [],
  migrationTableExists: true,
  riskLevel: "low",
  blockers: [],
  warnings: [],
  recommendation: "PostgreSQL listo para continuar con el pipeline de release",
};

function createMockPostgres(overrides: Partial<PostgresReleaseReadiness> = {}): PostgresProvider {
  const readiness = { ...cleanPostgresReadiness, ...overrides };

  return {
    name: "postgres",
    isConfigured: () => true,
    assessReleaseReadiness: vi.fn().mockResolvedValue(readiness),
  } as unknown as PostgresProvider;
}

function createMockInvoker(
  overrides: Partial<Record<string, unknown>> = {},
  options: { risky?: boolean } = {},
): {
  invoker: ToolInvoker;
  invokeMock: ReturnType<typeof vi.fn>;
} {
  const status = options.risky ? riskyStatus : mockStatus;
  const staging = options.risky ? riskyStaging : mockStaging;

  const invokeMock = vi.fn((tool: ReleaseToolName) => {
    switch (tool) {
      case "vercel_status":
        return Promise.resolve(status);
      case "vercel_prepare_staging":
        return Promise.resolve(staging);
      case "vercel_validate_staging":
        return Promise.resolve({
          passed: true,
          issues: [],
          report: { passed: true, summary: "OK" },
          ...(overrides.validation as object),
        });
      case "vercel_deploy_release":
        return Promise.resolve({
          executed: true,
          success: true,
          deployment: { id: "dpl_new", url: "app.com" },
          ...(overrides.deploy as object),
        });
      case "vercel_rollback_release":
        return Promise.resolve({
          executed: true,
          success: true,
          deployment: { id: "dpl_prev" },
          ...(overrides.rollback as object),
        });
      default: {
        const _exhaustive: never = tool;
        return Promise.reject(new Error(`Unknown tool: ${String(_exhaustive)}`));
      }
    }
  });

  return {
    invoker: { invoke: invokeMock as ToolInvoker["invoke"] },
    invokeMock,
  };
}

class BlockingExecuteBrain extends DnxBrain {
  override evaluate(input: BrainInput, options: BrainEvaluateOptions = {}) {
    const decision = super.evaluate(input, options);
    if (input.context.operation === "release.execute") {
      return {
        ...decision,
        verdict: "reject" as const,
        rejected: true,
        shouldBlock: true,
        recommendation: "Ejecución bloqueada por política de riesgo",
      };
    }
    return decision;
  }
}

describe("ReleaseState", () => {
  it("transiciona entre fases", () => {
    const state = new ReleaseState();
    state.transition("preparing");
    state.transition("prepared");
    expect(state.getPhase()).toBe("prepared");
    expect(state.getHistory()).toHaveLength(2);
  });

  it("valida fase esperada", () => {
    const state = new ReleaseState();
    state.transition("prepared");
    expect(() => {
      state.assertPhase("idle", "test");
    }).toThrow();
  });
});

describe("release-checklist", () => {
  it("calcula riesgos desde status y staging", () => {
    const risks = buildRisks(mockStatus, mockStaging);
    expect(risks.length).toBeGreaterThanOrEqual(0);
  });

  it("genera checklist completo", () => {
    const risks = buildRisks(mockStatus, mockStaging);
    const checklist = buildChecklist(mockStatus, mockStaging, risks);
    expect(checklist.find((c) => c.id === "staging_ready")?.status).toBe("ready");
  });

  it("determina readiness para validación", () => {
    const risks = buildRisks(mockStatus, mockStaging);
    const checklist = buildChecklist(mockStatus, mockStaging, risks);
    expect(isReadyForValidation(checklist, risks)).toBe(true);
  });
});

describe("ReleaseOrchestrator", () => {
  it("prepareRelease invoca status y staging con vercelProject de la plataforma", async () => {
    const { invoker, invokeMock } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });

    const result = await orchestrator.prepareRelease({ platform: testPlatform });

    expect(invokeMock).toHaveBeenCalledWith(
      "vercel_status",
      expect.objectContaining({ project: "app" }),
    );
    expect(invokeMock).toHaveBeenCalledWith(
      "vercel_prepare_staging",
      expect.objectContaining({ project: "app" }),
    );
    expect(result.phase).toBe("prepared");
    expect(result.platformId).toBe("fotorank");
    expect(result.vercelProject).toBe("app");
    expect(result.plan.readyForValidation).toBe(true);
    expect(result.metrics.steps).toHaveLength(2);
    expect(result.brain.score).toBeGreaterThan(0);
    expect(result.report.brain).toBeDefined();
  });

  it("validateRelease retorna GO con riesgo bajo y Brain aprobado", async () => {
    const { invoker } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });

    await orchestrator.prepareRelease({ platform: testPlatform });
    const result = await orchestrator.validateRelease({ platform: testPlatform });

    expect(result.decision).toBe("GO");
    expect(result.phase).toBe("validated");
    expect(result.brain.shouldBlock).toBe(false);
    expect(result.brain.score).toBeGreaterThanOrEqual(75);
    expect(result.report.brain).toMatchObject({
      score: result.brain.score,
      confidence: result.brain.confidence,
      shouldBlock: false,
    });
  });

  it("validateRelease retorna NO-GO con riesgo alto (Brain bloquea)", async () => {
    const { invoker } = createMockInvoker({}, { risky: true });
    const orchestrator = new ReleaseOrchestrator({ invoker });

    await orchestrator.prepareRelease({ platform: testPlatform });
    const result = await orchestrator.validateRelease({ platform: testPlatform });

    expect(result.decision).toBe("NO-GO");
    expect(result.phase).toBe("failed");
    expect(result.brain.shouldBlock).toBe(true);
    expect(result.report.brain).toMatchObject({
      shouldBlock: true,
    });
    expect(Array.isArray(result.brain.nextActions)).toBe(true);
  });

  it("validateRelease retorna NO-GO con issues de validación", async () => {
    const { invoker } = createMockInvoker({
      validation: { passed: false, issues: ["Build failed"] },
    });
    const orchestrator = new ReleaseOrchestrator({ invoker });

    await orchestrator.prepareRelease({ platform: testPlatform });
    const result = await orchestrator.validateRelease({ platform: testPlatform });

    expect(result.decision).toBe("NO-GO");
    expect(result.phase).toBe("failed");
  });

  it("executeRelease requiere confirmación", async () => {
    const { invoker } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });

    await orchestrator.prepareRelease({ platform: testPlatform });
    await orchestrator.validateRelease({ platform: testPlatform });

    await expect(
      orchestrator.executeRelease({ platform: testPlatform, confirm: false }),
    ).rejects.toThrow("Confirmación requerida");
  });

  it("executeRelease bloqueado por Brain aunque confirm=true", async () => {
    const { invoker } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({
      invoker,
      brain: new BlockingExecuteBrain(),
    });

    await orchestrator.prepareRelease({ platform: testPlatform });
    await orchestrator.validateRelease({ platform: testPlatform });

    await expect(
      orchestrator.executeRelease({ platform: testPlatform, confirm: true }),
    ).rejects.toThrow("bloqueado por DNX Brain");
  });

  it("executeRelease en dryRun no requiere confirm ni deploy real", async () => {
    const { invoker } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });

    const result = await orchestrator.executeRelease({
      platform: testPlatform,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.platformId).toBe("fotorank");
    expect(result.brain).not.toBeNull();
    expect(result.report.brain).toBeDefined();
  });

  it("rollbackRelease en dryRun simula sin confirm", async () => {
    const { invoker, invokeMock } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });

    const result = await orchestrator.rollbackRelease({
      platform: testPlatform,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith(
      "vercel_rollback_release",
      expect.objectContaining({ project: "app", dryRun: true }),
    );
  });

  it("rechaza plataforma inválida", async () => {
    const { invoker } = createMockInvoker();
    const orchestrator = new ReleaseOrchestrator({ invoker });
    const invalidPlatform = { ...testPlatform, id: "INVALID" };

    await expect(orchestrator.prepareRelease({ platform: invalidPlatform })).rejects.toThrow(
      "Plataforma inválida",
    );
  });

  describe("integración Git", () => {
    it("repo limpio no bloquea validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("GO");
      expect(result.git?.riskLevel).toBe("low");
      expect(result.brain.shouldBlock).toBe(false);
      expect(result.report.git).toMatchObject({
        branch: "main",
        dirtyTree: false,
        unpushedCommits: 0,
      });
    });

    it("dirty tree → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit({
          dirtyTree: true,
          riskLevel: "high",
          blockers: ["Hay cambios sin commitear en el working tree"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.brain.shouldBlock).toBe(true);
      expect(result.git?.dirtyTree).toBe(true);
    });

    it("unpushed commits → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit({
          unpushedCommits: 3,
          riskLevel: "high",
          blockers: ["3 commit(s) local(es) sin push al remoto"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.git?.unpushedCommits).toBe(3);
    });

    it("rama incorrecta → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit({ branch: "feature/wip" }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.git?.branch).toBe("feature/wip");
      expect(result.git?.blockers.some((b) => b.includes("no permitida"))).toBe(true);
    });

    it("executeRelease bloqueado por Git con confirm=true", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      await orchestrator.validateRelease({ platform: testPlatform });

      const dirtyGit = createMockGit({
        dirtyTree: true,
        riskLevel: "high",
        blockers: ["Hay cambios sin commitear en el working tree"],
      });

      const blockingOrchestrator = new ReleaseOrchestrator({
        invoker,
        git: dirtyGit,
      });
      blockingOrchestrator.state.bindPlatform("fotorank");
      blockingOrchestrator.state.transition("validated", "test setup");
      blockingOrchestrator.state.setValidationDecision("GO");
      blockingOrchestrator.state.setSnapshots(mockStatus, mockStaging);

      await expect(
        blockingOrchestrator.executeRelease({ platform: testPlatform, confirm: true }),
      ).rejects.toThrow("bloqueado por DNX Brain");
    });

    it("dryRun muestra riesgo Git pero simula deploy", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        git: createMockGit({
          dirtyTree: true,
          riskLevel: "high",
          blockers: ["Hay cambios sin commitear en el working tree"],
        }),
      });

      const result = await orchestrator.executeRelease({
        platform: testPlatform,
        dryRun: true,
      });

      expect(result.executed).toBe(true);
      expect(result.git?.dirtyTree).toBe(true);
      expect(result.report.git).toMatchObject({ riskLevel: "high" });
    });
  });

  describe("integración Prisma", () => {
    it("schema válido no bloquea validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("GO");
      expect(result.prisma?.schemaValid).toBe(true);
      expect(result.brain.shouldBlock).toBe(false);
      expect(result.report.prisma).toMatchObject({
        schemaValid: true,
        migrationCount: 5,
        riskLevel: "low",
      });
    });

    it("schema inválido → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma({
          schemaValid: false,
          riskLevel: "high",
          blockers: ["Schema Prisma inválido — ejecutar prisma validate localmente"],
          driftRisk: {
            level: "high",
            reasons: ["El schema Prisma no pasa validación"],
            pendingMigrations: false,
            schemaInvalid: true,
            formatDrift: false,
          },
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.brain.shouldBlock).toBe(true);
      expect(result.prisma?.schemaValid).toBe(false);
    });

    it("migraciones pendientes → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma({
          pendingMigrations: ["20240101000000_init"],
          riskLevel: "high",
          blockers: ["Migraciones pendientes: 20240101000000_init"],
          driftRisk: {
            level: "high",
            reasons: ["1 migración(es) pendiente(s) de aplicar"],
            pendingMigrations: true,
            schemaInvalid: false,
            formatDrift: false,
          },
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.prisma?.pendingMigrations).toEqual(["20240101000000_init"]);
    });

    it("drift de formato → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma({
          riskLevel: "medium",
          warnings: ["El schema no está formateado según prisma format"],
          driftRisk: {
            level: "medium",
            reasons: ["El schema no cumple prisma format --check"],
            pendingMigrations: false,
            schemaInvalid: false,
            formatDrift: true,
          },
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.brain.shouldBlock).toBe(true);
      expect(result.prisma?.driftRisk.formatDrift).toBe(true);
    });

    it("executeRelease bloqueado por Prisma con confirm=true", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      await orchestrator.validateRelease({ platform: testPlatform });

      const blockingPrisma = createMockPrisma({
        schemaValid: false,
        riskLevel: "high",
        blockers: ["Schema Prisma inválido — ejecutar prisma validate localmente"],
        driftRisk: {
          level: "high",
          reasons: ["El schema Prisma no pasa validación"],
          pendingMigrations: false,
          schemaInvalid: true,
          formatDrift: false,
        },
      });

      const blockingOrchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: blockingPrisma,
      });
      blockingOrchestrator.state.bindPlatform("fotorank");
      blockingOrchestrator.state.transition("validated", "test setup");
      blockingOrchestrator.state.setValidationDecision("GO");
      blockingOrchestrator.state.setSnapshots(mockStatus, mockStaging);

      await expect(
        blockingOrchestrator.executeRelease({ platform: testPlatform, confirm: true }),
      ).rejects.toThrow("bloqueado por DNX Brain");
    });

    it("dryRun permite deploy con riesgo Prisma", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        prisma: createMockPrisma({
          schemaValid: false,
          riskLevel: "high",
          blockers: ["Schema Prisma inválido"],
          driftRisk: {
            level: "high",
            reasons: ["El schema Prisma no pasa validación"],
            pendingMigrations: false,
            schemaInvalid: true,
            formatDrift: false,
          },
        }),
      });

      const result = await orchestrator.executeRelease({
        platform: testPlatform,
        dryRun: true,
      });

      expect(result.executed).toBe(true);
      expect(result.prisma?.schemaValid).toBe(false);
      expect(result.report.prisma).toMatchObject({ riskLevel: "high" });
    });
  });

  describe("integración PostgreSQL", () => {
    it("postgres OK → no bloquea validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("GO");
      expect(result.postgres?.connected).toBe(true);
      expect(result.brain.shouldBlock).toBe(false);
      expect(result.report.postgres).toMatchObject({
        connected: true,
        migrationTableExists: true,
        riskLevel: "low",
      });
    });

    it("no conecta → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres({
          connected: false,
          riskLevel: "high",
          blockers: ["No se pudo conectar a PostgreSQL"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.brain.shouldBlock).toBe(true);
      expect(result.postgres?.connected).toBe(false);
    });

    it("locks críticos → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres({
          locks: [
            {
              pid: 42,
              lockType: "relation",
              mode: "AccessExclusiveLock",
              granted: false,
              relation: "users",
              query: "ALTER TABLE users",
            },
          ],
          riskLevel: "high",
          blockers: ["1 lock(s) en espera"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.postgres?.locks.some((lock) => !lock.granted)).toBe(true);
    });

    it("long running queries → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres({
          longRunningQueries: [
            {
              pid: 99,
              usename: "app",
              applicationName: "api",
              state: "active",
              query: "SELECT 1",
              queryStart: "2026-01-01T00:00:00Z",
              waitEventType: null,
              durationMs: 90_000,
            },
          ],
          riskLevel: "high",
          blockers: ["1 query(s) de larga duración activa(s)"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.postgres?.longRunningQueries).toHaveLength(1);
    });

    it("migration table missing → NO-GO en validate", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres({
          migrationTableExists: false,
          riskLevel: "medium",
          warnings: ["Tabla _prisma_migrations no encontrada"],
        }),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("NO-GO");
      expect(result.brain.shouldBlock).toBe(true);
      expect(result.postgres?.migrationTableExists).toBe(false);
    });

    it("executeRelease bloqueado por PostgreSQL con confirm=true", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres(),
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      await orchestrator.validateRelease({ platform: testPlatform });

      const blockingPostgres = createMockPostgres({
        connected: false,
        riskLevel: "high",
        blockers: ["No se pudo conectar a PostgreSQL"],
      });

      const blockingOrchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: blockingPostgres,
      });
      blockingOrchestrator.state.bindPlatform("fotorank");
      blockingOrchestrator.state.transition("validated", "test setup");
      blockingOrchestrator.state.setValidationDecision("GO");
      blockingOrchestrator.state.setSnapshots(mockStatus, mockStaging);

      await expect(
        blockingOrchestrator.executeRelease({ platform: testPlatform, confirm: true }),
      ).rejects.toThrow("bloqueado");
    });

    it("dryRun permite deploy con riesgo PostgreSQL", async () => {
      const { invoker } = createMockInvoker();
      const orchestrator = new ReleaseOrchestrator({
        invoker,
        postgres: createMockPostgres({
          connected: false,
          riskLevel: "high",
          blockers: ["No se pudo conectar a PostgreSQL"],
        }),
      });

      const result = await orchestrator.executeRelease({
        platform: testPlatform,
        dryRun: true,
      });

      expect(result.executed).toBe(true);
      expect(result.postgres?.connected).toBe(false);
      expect(result.report.postgres).toMatchObject({ riskLevel: "high" });
    });
  });

  describe("integración ProviderRegistry", () => {
    it("release usa git, prisma y postgres desde el registry", async () => {
      const { invoker } = createMockInvoker();
      const gitAssessSpy = vi.fn().mockResolvedValue(cleanGitReadiness);
      const prismaAssessSpy = vi.fn().mockResolvedValue(cleanPrismaReadiness);
      const postgresAssessSpy = vi.fn().mockResolvedValue(cleanPostgresReadiness);

      const mockGit = {
        name: "git",
        isConfigured: () => true,
        assessReleaseReadiness: gitAssessSpy,
      } as unknown as GitProvider;

      const mockPrisma = {
        name: "prisma",
        isConfigured: () => true,
        assessReleaseReadiness: prismaAssessSpy,
      } as unknown as PrismaProvider;

      const mockPostgres = {
        name: "postgres",
        isConfigured: () => true,
        assessReleaseReadiness: postgresAssessSpy,
      } as unknown as PostgresProvider;

      const registry = new ProviderRegistry()
        .registerProvider("git", mockGit)
        .registerProvider("prisma", mockPrisma)
        .registerProvider("postgres", mockPostgres);

      const orchestrator = new ReleaseOrchestrator({
        invoker,
        providerRegistry: registry,
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.decision).toBe("GO");
      expect(gitAssessSpy).toHaveBeenCalled();
      expect(prismaAssessSpy).toHaveBeenCalled();
      expect(postgresAssessSpy).toHaveBeenCalled();
      expect(result.git?.riskLevel).toBe("low");
      expect(result.prisma?.schemaValid).toBe(true);
      expect(result.postgres?.connected).toBe(true);
    });

    it("fallback directo tiene prioridad sobre el registry", async () => {
      const { invoker } = createMockInvoker();
      const registryAssessSpy = vi
        .fn()
        .mockResolvedValue({ ...cleanGitReadiness, branch: "registry-branch" });
      const directAssessSpy = vi
        .fn()
        .mockResolvedValue({ ...cleanGitReadiness, branch: "direct-branch" });

      const registryGit = {
        name: "git",
        isConfigured: () => true,
        assessReleaseReadiness: registryAssessSpy,
      } as unknown as GitProvider;

      const directGit = {
        name: "git",
        isConfigured: () => true,
        assessReleaseReadiness: directAssessSpy,
      } as unknown as GitProvider;

      const registry = new ProviderRegistry()
        .registerProvider("git", registryGit)
        .registerProvider("prisma", createMockPrisma());

      const orchestrator = new ReleaseOrchestrator({
        invoker,
        providerRegistry: registry,
        git: directGit,
      });

      await orchestrator.prepareRelease({ platform: testPlatform });
      const result = await orchestrator.validateRelease({ platform: testPlatform });

      expect(result.git?.branch).toBe("direct-branch");
      expect(directAssessSpy).toHaveBeenCalled();
      expect(registryAssessSpy).not.toHaveBeenCalled();
    });
  });
});
