import { describe, expect, it } from "vitest";
import { DecisionHistory } from "./decision-history.js";
import type { BrainDecision, BrainInput } from "../types.js";

const sampleInput: BrainInput = {
  context: {
    operation: "release.prepare",
    platformId: "fotorank",
    platformName: "Fotorank",
  },
  signals: [],
};

const sampleDecision: BrainDecision = {
  verdict: "approve",
  score: 80,
  confidence: 0.85,
  reasoning: ["OK"],
  recommendation: "Aprobado",
  nextActions: [],
  risks: [],
  inconsistencies: [],
  rejected: false,
  shouldBlock: false,
  context: sampleInput.context,
  evaluatedAt: new Date().toISOString(),
};

describe("DecisionHistory", () => {
  it("registra y recupera decisiones", () => {
    const history = new DecisionHistory();
    const record = history.record(sampleInput, sampleDecision);

    expect(record.id).toMatch(/^decision-/);
    expect(history.getAll()).toHaveLength(1);
    expect(history.getLatest("fotorank")).toEqual(record);
  });

  it("calcula estadísticas", () => {
    const history = new DecisionHistory();

    history.record(sampleInput, sampleDecision);
    history.record(sampleInput, {
      ...sampleDecision,
      verdict: "reject",
      rejected: true,
      score: 40,
    });
    history.record(
      { ...sampleInput, context: { ...sampleInput.context, platformId: "camofduty" } },
      { ...sampleDecision, verdict: "caution", score: 60 },
    );

    const stats = history.getStats();
    expect(stats.totalDecisions).toBe(3);
    expect(stats.approvals).toBe(1);
    expect(stats.rejections).toBe(1);
    expect(stats.cautions).toBe(1);
    expect(stats.averageScore).toBe(60);
  });

  it("respeta límite máximo de registros", () => {
    const history = new DecisionHistory(2);

    history.record(sampleInput, sampleDecision);
    history.record(sampleInput, { ...sampleDecision, score: 70 });
    history.record(sampleInput, { ...sampleDecision, score: 90 });

    expect(history.getAll()).toHaveLength(2);
    expect(history.getAll()[0]?.decision.score).toBe(70);
  });

  it("clear vacía el historial", () => {
    const history = new DecisionHistory();
    history.record(sampleInput, sampleDecision);
    history.clear();

    expect(history.getStats().totalDecisions).toBe(0);
  });
});
