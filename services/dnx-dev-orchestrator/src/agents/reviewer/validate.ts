import { ReviewDecisionSchema, type ReviewDecision } from "./schema.js";

export type ValidatedReviewDecision =
  | { ok: true; decision: ReviewDecision }
  | {
      ok: false;
      reason: string;
      code: "SCHEMA_INVALID" | "INVARIANT_INVALID";
    };

/**
 * Programmatic invariants — CODE POLICY > model output.
 */
export function validateReviewInvariants(decision: ReviewDecision): { ok: true } | { ok: false; reason: string } {
  const hasCritical = decision.issues.some((i) => i.severity === "CRITICAL");
  const hasErrorOrCritical = decision.issues.some(
    (i) => i.severity === "ERROR" || i.severity === "CRITICAL",
  );
  const hasRetryIssue = decision.issues.some((i) => i.retryRecommended);

  if (decision.decision === "STAGE_COMPLETED") {
    if (hasCritical) {
      return { ok: false, reason: "STAGE_COMPLETED forbidden when CRITICAL issues exist" };
    }
    const criticalMissing = decision.missingEvidence.filter((item) =>
      /test|typecheck|lint|validation|criterion|criteria|security|secret/i.test(item),
    );
    if (criticalMissing.length > 0) {
      return {
        ok: false,
        reason: `STAGE_COMPLETED has critical missingEvidence: ${criticalMissing.join("; ")}`,
      };
    }
  }

  if (decision.decision === "FAILED" && !hasErrorOrCritical) {
    return { ok: false, reason: "FAILED requires at least one ERROR or CRITICAL issue" };
  }

  if (decision.decision === "HUMAN_REQUIRED") {
    const hasReason =
      decision.summary.trim().length > 0 &&
      (decision.evidence.length > 0 || decision.missingEvidence.length > 0 || decision.issues.length > 0);
    if (!hasReason) {
      return {
        ok: false,
        reason: "HUMAN_REQUIRED requires evidence/missingEvidence/issues explaining the human gate",
      };
    }
  }

  if (decision.decision === "CREATE_NEXT_STAGE" && !decision.nextStageRecommendation) {
    return { ok: false, reason: "CREATE_NEXT_STAGE requires nextStageRecommendation" };
  }

  if (decision.decision === "RETRY_STAGE") {
    if (!decision.retryRecommended && !hasRetryIssue) {
      return {
        ok: false,
        reason: "RETRY_STAGE requires retryRecommended=true or an issue with retryRecommended=true",
      };
    }
    if (!hasRetryIssue) {
      return { ok: false, reason: "RETRY_STAGE requires at least one issue with retryRecommended=true" };
    }
  }

  if (decision.decision === "BLOCKED") {
    if (decision.issues.length === 0 && decision.evidence.length === 0 && !decision.summary.trim()) {
      return { ok: false, reason: "BLOCKED requires summary and evidence or issues" };
    }
  }

  if (decision.taskDisposition === "TASK_COMPLETED" && decision.decision !== "STAGE_COMPLETED" && decision.decision !== "CREATE_NEXT_STAGE") {
    // Conservative: only allow TASK_COMPLETED alongside stage success decisions.
    return {
      ok: false,
      reason: "taskDisposition=TASK_COMPLETED only allowed with STAGE_COMPLETED or CREATE_NEXT_STAGE",
    };
  }

  return { ok: true };
}

export function validateReviewDecision(raw: unknown): ValidatedReviewDecision {
  const parsed = ReviewDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SCHEMA_INVALID",
      reason: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const invariants = validateReviewInvariants(parsed.data);
  if (!invariants.ok) {
    return { ok: false, code: "INVARIANT_INVALID", reason: invariants.reason };
  }

  return { ok: true, decision: parsed.data };
}
