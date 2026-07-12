import { describe, expect, it } from "vitest";
import { ActionPlanner } from "./planner.js";
import type { BrainContext } from "../types.js";

describe("ActionPlanner", () => {
  const planner = new ActionPlanner();

  const context: BrainContext = {
    operation: "release.validate",
    platformId: "fotorank",
    platformName: "Fotorank",
  };

  it("propone run-validate tras prepare aprobado", () => {
    const actions = planner.plan({
      context: { ...context, operation: "release.prepare" },
      verdict: "approve",
      risks: [],
      inconsistencies: [],
      rejected: false,
    });

    expect(actions.some((a) => a.id === "run-validate")).toBe(true);
  });

  it("propone halt-operation cuando está rechazado", () => {
    const actions = planner.plan({
      context,
      verdict: "reject",
      risks: [
        {
          id: "r1",
          level: "critical",
          source: "test",
          message: "Riesgo crítico",
          weight: 40,
          blocking: true,
        },
      ],
      inconsistencies: [],
      rejected: true,
    });

    expect(actions[0]?.id).toBe("halt-operation");
    expect(actions.some((a) => a.id === "resolve-risk-r1")).toBe(true);
  });

  it("añade acción de dry-run review", () => {
    const actions = planner.plan({
      context: { ...context, dryRun: true },
      verdict: "caution",
      risks: [],
      inconsistencies: [],
      rejected: false,
    });

    expect(actions.some((a) => a.id === "review-dry-run")).toBe(true);
  });
});
