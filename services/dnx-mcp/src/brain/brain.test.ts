import { describe, expect, it } from "vitest";
import { DnxBrain } from "./index.js";
import type { BrainContext, BrainInput, BrainSignal } from "./types.js";

const baseContext: BrainContext = {
  operation: "release.prepare",
  platformId: "fotorank",
  platformName: "Fotorank",
  orchestrator: "release",
};

function signal(
  overrides: Partial<BrainSignal> & Pick<BrainSignal, "key" | "message">,
): BrainSignal {
  return {
    source: "orchestrator",
    type: "checklist",
    ...overrides,
  };
}

function input(context: Partial<BrainContext> = {}, signals: BrainSignal[] = []): BrainInput {
  return {
    context: { ...baseContext, ...context },
    signals,
  };
}

describe("DnxBrain", () => {
  it("aprueba prepare con señales positivas", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.prepare" }, [
        signal({ type: "checklist", key: "staging.ready", value: true, message: "Staging listo" }),
        signal({ type: "health", key: "deployment.status", value: "healthy", message: "Healthy" }),
      ]),
    );

    expect(decision.verdict).toBe("approve");
    expect(decision.rejected).toBe(false);
    expect(decision.shouldBlock).toBe(false);
    expect(decision.score).toBeGreaterThanOrEqual(75);
    expect(decision.confidence).toBeGreaterThan(0.5);
    expect(decision.reasoning.length).toBeGreaterThan(0);
    expect(decision.recommendation).toContain("aprobada");
    expect(decision.nextActions.length).toBeGreaterThan(0);
    expect(decision.evaluatedAt).toBeTruthy();
  });

  it("rechaza execute con mantenimiento activo", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.execute" }, [
        signal({
          type: "policy",
          key: "maintenance.enabled",
          value: true,
          message: "Mantenimiento activo",
        }),
        signal({
          type: "state",
          key: "staging.validated",
          value: true,
          message: "Staging validado",
        }),
      ]),
    );

    expect(decision.verdict).toBe("reject");
    expect(decision.rejected).toBe(true);
    expect(decision.shouldBlock).toBe(true);
    expect(decision.inconsistencies.some((i) => i.id === "maintenance-vs-execute")).toBe(true);
    expect(decision.recommendation).toContain("Rechazar");
    expect(decision.nextActions.some((a) => a.id === "halt-operation")).toBe(true);
  });

  it("rechaza execute sin staging validado", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.execute" }, [
        signal({ type: "checklist", key: "staging.ready", value: true, message: "Listo" }),
      ]),
    );

    expect(decision.rejected).toBe(true);
    expect(decision.shouldBlock).toBe(true);
    expect(decision.verdict).toBe("reject");
  });

  it("rechaza execute con riesgo crítico bloqueante", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.execute" }, [
        signal({
          type: "state",
          key: "staging.validated",
          value: true,
          message: "Validado",
        }),
        signal({
          type: "risk",
          key: "health",
          severity: "critical",
          message: "Health failed en producción",
        }),
      ]),
    );

    expect(decision.rejected).toBe(true);
    expect(decision.shouldBlock).toBe(true);
    expect(decision.risks.some((r) => r.blocking)).toBe(true);
  });

  it("detecta inconsistencia GO con issues en validate", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.validate" }, [
        signal({
          type: "state",
          key: "validation.decision",
          value: "GO",
          message: "GO",
        }),
        signal({
          type: "metric",
          key: "validation.issues.count",
          value: 3,
          message: "3 issues",
        }),
      ]),
    );

    expect(decision.inconsistencies.some((i) => i.id === "go-with-issues")).toBe(true);
    expect(decision.score).toBeLessThan(75);
  });

  it("penaliza señales Git sucias", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.validate" }, [
        signal({
          source: "git",
          type: "state",
          key: "git.dirtyTree",
          value: true,
          message: "Working tree sucio — hay cambios sin commitear",
          severity: "critical",
        }),
        signal({
          source: "git",
          type: "metric",
          key: "git.unpushedCommits",
          value: 2,
          message: "2 commit(s) sin push",
          severity: "high",
        }),
      ]),
    );

    expect(decision.shouldBlock).toBe(true);
    expect(decision.nextActions.some((a) => a.id === "git-commit-changes")).toBe(true);
    expect(decision.nextActions.some((a) => a.id === "git-push-commits")).toBe(true);
  });

  it("penaliza señales PostgreSQL críticas", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.validate" }, [
        signal({
          source: "postgres",
          type: "state",
          key: "postgres.connected",
          value: false,
          message: "PostgreSQL no conectado — no se pudo evaluar la base",
          severity: "critical",
        }),
        signal({
          source: "postgres",
          type: "metric",
          key: "postgres.longRunningQueries",
          value: 2,
          message: "2 query(s) de larga duración",
          severity: "critical",
        }),
        signal({
          source: "postgres",
          type: "metric",
          key: "postgres.locks",
          value: 1,
          message: "1 lock(s) bloqueante(s)",
          severity: "high",
        }),
      ]),
    );

    expect(decision.shouldBlock).toBe(true);
    expect(decision.nextActions.some((a) => a.id === "postgres-verify-connection")).toBe(true);
    expect(decision.nextActions.some((a) => a.id === "postgres-terminate-long-queries")).toBe(true);
    expect(decision.nextActions.some((a) => a.id === "postgres-review-locks")).toBe(true);
  });

  it("dryRun nunca aprueba con verdict approve", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(
      input({ operation: "release.prepare", dryRun: true }, [
        signal({ type: "checklist", key: "staging.ready", value: true, message: "Listo" }),
        signal({ type: "health", key: "api", value: "healthy", message: "OK" }),
      ]),
    );

    expect(decision.verdict).not.toBe("approve");
    expect(decision.reasoning.some((r) => r.includes("dryRun"))).toBe(true);
  });

  it("registra historial por defecto", () => {
    const brain = new DnxBrain();
    brain.evaluate(input());
    brain.evaluate(input({ platformId: "camofduty" }));

    const stats = brain.getHistory().getStats();
    expect(stats.totalDecisions).toBe(2);
    expect(brain.getHistory().getByPlatform("fotorank")).toHaveLength(1);
  });

  it("puede omitir historial", () => {
    const brain = new DnxBrain();
    brain.evaluate(input(), { recordHistory: false });

    expect(brain.getHistory().getStats().totalDecisions).toBe(0);
  });

  it("incluye todos los campos requeridos en la decisión", () => {
    const brain = new DnxBrain();
    const decision = brain.evaluate(input());

    expect(["approve", "caution", "reject"]).toContain(decision.verdict);
    expect(decision.score).toBeGreaterThanOrEqual(0);
    expect(decision.score).toBeLessThanOrEqual(100);
    expect(decision.confidence).toBeGreaterThanOrEqual(0.1);
    expect(decision.confidence).toBeLessThanOrEqual(0.99);
    expect(Array.isArray(decision.reasoning)).toBe(true);
    expect(decision.recommendation.length).toBeGreaterThan(0);
    expect(Array.isArray(decision.nextActions)).toBe(true);
    expect(Array.isArray(decision.risks)).toBe(true);
    expect(Array.isArray(decision.inconsistencies)).toBe(true);
    expect(typeof decision.rejected).toBe("boolean");
    expect(typeof decision.shouldBlock).toBe("boolean");
    expect(decision.context.platformId).toBe("fotorank");
    expect(decision.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
