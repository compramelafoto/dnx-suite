import { describe, expect, it } from "vitest";
import { ReviewDecisionSchema } from "../src/agents/reviewer/schema.js";
import { validateReviewDecision, validateReviewInvariants } from "../src/agents/reviewer/validate.js";
import type { ReviewDecision } from "../src/agents/reviewer/schema.js";

function base(overrides: Partial<ReviewDecision> = {}): ReviewDecision {
  return {
    decision: "STAGE_COMPLETED",
    summary: "ok",
    evidence: ["e1"],
    missingEvidence: [],
    issues: [],
    retryRecommended: false,
    nextStageRecommendation: null,
    taskDisposition: "CONTINUE",
    ...overrides,
  };
}

describe("ReviewDecisionSchema + invariants", () => {
  it("accepts valid STAGE_COMPLETED", () => {
    const parsed = ReviewDecisionSchema.safeParse(base());
    expect(parsed.success).toBe(true);
    expect(validateReviewDecision(base()).ok).toBe(true);
  });

  it("rejects STAGE_COMPLETED with CRITICAL issue", () => {
    const decision = base({
      issues: [
        {
          severity: "CRITICAL",
          code: "X",
          message: "critical",
          retryRecommended: false,
        },
      ],
    });
    expect(ReviewDecisionSchema.safeParse(decision).success).toBe(true);
    expect(validateReviewInvariants(decision).ok).toBe(false);
    expect(validateReviewDecision(decision).ok).toBe(false);
  });

  it("RETRY_STAGE requires retry issue", () => {
    const bad = base({
      decision: "RETRY_STAGE",
      retryRecommended: true,
      issues: [{ severity: "WARNING", code: "W", message: "w", retryRecommended: false }],
    });
    expect(validateReviewDecision(bad).ok).toBe(false);

    const good = base({
      decision: "RETRY_STAGE",
      retryRecommended: true,
      missingEvidence: ["tests"],
      issues: [{ severity: "ERROR", code: "R", message: "retry", retryRecommended: true }],
    });
    expect(validateReviewDecision(good).ok).toBe(true);
  });

  it("CREATE_NEXT_STAGE requires recommendation", () => {
    const bad = base({
      decision: "CREATE_NEXT_STAGE",
      nextStageRecommendation: null,
    });
    expect(ReviewDecisionSchema.safeParse(bad).success).toBe(false);

    const good = base({
      decision: "CREATE_NEXT_STAGE",
      nextStageRecommendation: {
        title: "NEXT",
        objective: "do next",
        reason: "because",
        riskLevel: "LOW",
      },
    });
    expect(validateReviewDecision(good).ok).toBe(true);
  });

  it("FAILED requires ERROR or CRITICAL", () => {
    const bad = base({
      decision: "FAILED",
      issues: [{ severity: "WARNING", code: "W", message: "w", retryRecommended: false }],
    });
    expect(validateReviewDecision(bad).ok).toBe(false);

    const good = base({
      decision: "FAILED",
      issues: [{ severity: "ERROR", code: "E", message: "e", retryRecommended: false }],
    });
    expect(validateReviewDecision(good).ok).toBe(true);
  });

  it("HUMAN_REQUIRED needs explanatory evidence", () => {
    const bad = base({
      decision: "HUMAN_REQUIRED",
      evidence: [],
      missingEvidence: [],
      issues: [],
      taskDisposition: "HUMAN_REQUIRED",
    });
    expect(validateReviewDecision(bad).ok).toBe(false);

    const good = base({
      decision: "HUMAN_REQUIRED",
      evidence: ["need approval"],
      taskDisposition: "HUMAN_REQUIRED",
    });
    expect(validateReviewDecision(good).ok).toBe(true);
  });
});
