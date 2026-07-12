import { describe, expect, it } from "vitest";
import { Recommender } from "./recommender.js";
import type { BrainContext } from "../types.js";

describe("Recommender", () => {
  const recommender = new Recommender();

  const context: BrainContext = {
    operation: "release.execute",
    platformId: "fotorank",
    platformName: "Fotorank",
  };

  it("genera recomendación de aprobación", () => {
    const text = recommender.recommend({
      context,
      verdict: "approve",
      score: 85,
      confidence: 0.9,
      risks: [],
      inconsistencies: [],
      rejected: false,
    });

    expect(text).toContain("aprobada");
    expect(text).toContain("Fotorank");
    expect(text).toContain("85");
  });

  it("genera recomendación de precaución", () => {
    const text = recommender.recommend({
      context,
      verdict: "caution",
      score: 65,
      confidence: 0.7,
      risks: [
        { id: "r1", level: "medium", source: "x", message: "Riesgo", weight: 12, blocking: false },
      ],
      inconsistencies: [],
      rejected: false,
    });

    expect(text).toContain("precaución");
    expect(text).toContain("1 riesgo");
  });

  it("genera recomendación de rechazo", () => {
    const text = recommender.recommend({
      context,
      verdict: "reject",
      score: 30,
      confidence: 0.5,
      risks: [
        {
          id: "r1",
          level: "critical",
          source: "x",
          message: "Bloqueo",
          weight: 40,
          blocking: true,
        },
      ],
      inconsistencies: [
        { id: "i1", severity: "critical", description: "Conflicto", signals: ["a", "b"] },
      ],
      rejected: true,
    });

    expect(text).toContain("Rechazar");
    expect(text).toContain("bloqueante");
  });
});
