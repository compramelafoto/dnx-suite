import { describe, expect, it } from "vitest";
import { RiskEngine } from "./risk-engine.js";
import type { BrainSignal } from "../types.js";

describe("RiskEngine", () => {
  const engine = new RiskEngine();

  it("evalúa señales de riesgo con peso por severidad", () => {
    const signals: BrainSignal[] = [
      {
        source: "checklist",
        type: "risk",
        key: "domain",
        message: "Dominio sin verificar en producción",
        severity: "high",
      },
    ];

    const result = engine.evaluate(signals, "release.execute");

    expect(result.risks).toHaveLength(1);
    expect(result.risks[0]?.weight).toBe(25);
    expect(result.hasBlockingRisk).toBe(true);
    expect(result.riskScorePenalty).toBe(25);
  });

  it("aplica patrones conocidos de riesgo", () => {
    const signals: BrainSignal[] = [
      {
        source: "logs",
        type: "issue",
        key: "build",
        message: "Build error detectado en logs de preview",
      },
    ];

    const result = engine.evaluate(signals, "release.validate");

    expect(result.risks).toHaveLength(1);
    expect(result.risks[0]?.level).toBe("high");
  });

  it("no marca bloqueante en operaciones no críticas", () => {
    const signals: BrainSignal[] = [
      {
        source: "checklist",
        type: "risk",
        key: "domain",
        message: "Dominio sin verificar",
        severity: "critical",
      },
    ];

    const result = engine.evaluate(signals, "release.prepare");

    expect(result.risks[0]?.blocking).toBe(false);
    expect(result.hasBlockingRisk).toBe(false);
  });

  it("deduplica riesgos idénticos", () => {
    const signals: BrainSignal[] = [
      {
        source: "a",
        type: "risk",
        key: "x",
        message: "Mismo riesgo",
        severity: "low",
      },
      {
        source: "a",
        type: "risk",
        key: "x2",
        message: "Mismo riesgo",
        severity: "low",
      },
    ];

    const result = engine.evaluate(signals, "release.prepare");
    expect(result.risks).toHaveLength(1);
  });

  it("ignora señales sin tipo risk/issue ni severidad", () => {
    const signals: BrainSignal[] = [
      {
        source: "metric",
        type: "metric",
        key: "count",
        message: "Solo métrica",
        value: 5,
      },
    ];

    const result = engine.evaluate(signals, "release.prepare");
    expect(result.risks).toHaveLength(0);
  });
});
