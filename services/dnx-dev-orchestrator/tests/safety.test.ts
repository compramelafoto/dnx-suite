import { describe, expect, it } from "vitest";
import { evaluateAction, getSafetyMatrix } from "../src/safety/policy.js";

describe("safety classifications", () => {
  it("classifies core actions", () => {
    expect(evaluateAction("READ_REPO").classification).toBe("SAFE_AUTOMATIC");
    expect(evaluateAction("CURSOR_ASK").classification).toBe("SAFE_AUTOMATIC");
    expect(evaluateAction("EDIT_WORKTREE").classification).toBe("SAFE_WITH_LIMITS");
    expect(evaluateAction("PUSH").classification).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(evaluateAction("DEPLOY_PRODUCTION").classification).toBe("FORBIDDEN_AUTOMATIC");
    expect(evaluateAction("FORCE_PUSH").allowed).toBe(false);
  });

  it("blocks SAFE_WITH_LIMITS while write execution is disabled", () => {
    const result = evaluateAction("EDIT_WORKTREE", { writeExecutionEnabled: false });
    expect(result.allowed).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it("exposes a complete matrix", () => {
    const matrix = getSafetyMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(20);
    expect(matrix.some((r) => r.action === "MERCADO_PAGO_PROD_CHANGE")).toBe(true);
  });
});
