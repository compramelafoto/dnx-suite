import { describe, expect, it } from "vitest";
import { DecisionEngine } from "./decision-engine.js";
import type { BrainInput } from "../types.js";

describe("DecisionEngine", () => {
  const engine = new DecisionEngine();

  it("calcula score con bonificaciones por señales positivas", () => {
    const input: BrainInput = {
      context: {
        operation: "release.prepare",
        platformId: "test",
        platformName: "Test",
      },
      signals: [
        {
          source: "checklist",
          type: "checklist",
          key: "staging.ready",
          message: "Listo",
          value: true,
        },
        {
          source: "health",
          type: "health",
          key: "api",
          message: "Healthy",
          value: "healthy",
        },
      ],
    };

    const decision = engine.evaluate(input);
    expect(decision.score).toBeGreaterThanOrEqual(90);
  });

  it("penaliza score por riesgos e inconsistencias", () => {
    const input: BrainInput = {
      context: {
        operation: "release.validate",
        platformId: "test",
        platformName: "Test",
      },
      signals: [
        {
          source: "state",
          type: "state",
          key: "validation.decision",
          message: "GO",
          value: "GO",
        },
        {
          source: "metric",
          type: "metric",
          key: "validation.issues.count",
          message: "Issues",
          value: 5,
        },
        {
          source: "risk",
          type: "risk",
          key: "env",
          message: "Variable difiere entre staging y producción",
          severity: "medium",
        },
      ],
    };

    const decision = engine.evaluate(input);
    expect(decision.score).toBeLessThan(80);
    expect(decision.inconsistencies.length).toBeGreaterThan(0);
    expect(decision.risks.length).toBeGreaterThan(0);
  });

  it("rechaza execute con score bajo del mínimo", () => {
    const input: BrainInput = {
      context: {
        operation: "release.execute",
        platformId: "test",
        platformName: "Test",
      },
      signals: [
        {
          source: "state",
          type: "state",
          key: "staging.validated",
          message: "OK",
          value: true,
        },
        {
          source: "risk",
          type: "risk",
          key: "a",
          message: "Health failed en endpoint crítico",
          severity: "critical",
        },
        {
          source: "risk",
          type: "risk",
          key: "b",
          message: "No hay deployment de preview disponible",
          severity: "high",
        },
      ],
    };

    const decision = engine.evaluate(input);
    expect(decision.rejected).toBe(true);
    expect(decision.score).toBeLessThan(80);
  });
});
