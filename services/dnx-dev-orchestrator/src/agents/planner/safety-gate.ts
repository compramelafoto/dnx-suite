import { evaluateAction } from "../../safety/policy.js";
import type { SafetyAction } from "../../safety/types.js";
import { SAFETY_ACTIONS } from "../../safety/types.js";
import { KNOWN_SAFETY_ACTION_SET, type PlannerDecision, type StagePlan } from "./schema.js";

export type StageSafetyGateResult =
  | { ok: true; normalizedAllowed: SafetyAction[] }
  | {
      ok: false;
      code: "HUMAN_REQUIRED" | "BLOCKED";
      reason: string;
    };

function asSafetyAction(value: string): SafetyAction | null {
  const normalized = value.trim().toUpperCase();
  if (KNOWN_SAFETY_ACTION_SET.has(normalized)) {
    return normalized as SafetyAction;
  }
  return null;
}

/**
 * CODE POLICY > MODEL OUTPUT.
 * Model cannot authorize forbidden/human-gated actions via allowedActions.
 */
export function evaluateStagePlanSafety(stage: StagePlan): StageSafetyGateResult {
  if (stage.riskLevel === "CRITICAL") {
    return {
      ok: false,
      code: "BLOCKED",
      reason: "CRITICAL riskLevel is blocked for autonomous execution.",
    };
  }

  const normalizedAllowed: SafetyAction[] = [];
  for (const raw of stage.allowedActions) {
    const action = asSafetyAction(raw);
    if (!action) {
      return {
        ok: false,
        code: "BLOCKED",
        reason: `Unknown allowedAction from model (not in policy): ${raw}`,
      };
    }

    const evaluation = evaluateAction(action, { writeExecutionEnabled: false });
    if (evaluation.classification === "FORBIDDEN_AUTOMATIC") {
      return {
        ok: false,
        code: "BLOCKED",
        reason: `Policy forbids allowing ${action} automatically.`,
      };
    }
    if (evaluation.classification === "HUMAN_APPROVAL_REQUIRED") {
      return {
        ok: false,
        code: "HUMAN_REQUIRED",
        reason: `Policy requires human approval for ${action}; model cannot auto-allow it.`,
      };
    }
    // SAFE_WITH_LIMITS remains blocked for autonomous execution in ETAPA 02 write-disabled mode,
    // but may appear in a planning prompt as a future limited action.
    normalizedAllowed.push(action);
  }

  return { ok: true, normalizedAllowed };
}

export function evaluatePlannerDecisionSafety(decision: PlannerDecision): StageSafetyGateResult | { ok: true } {
  if (!decision.stage) return { ok: true };
  return evaluateStagePlanSafety(decision.stage);
}

export function safetyPolicySummaryLines(): string[] {
  return SAFETY_ACTIONS.map((action) => {
    const ev = evaluateAction(action, { writeExecutionEnabled: false });
    return `${action}=${ev.classification};allowedNow=${ev.allowed ? "yes" : "no"}`;
  });
}
