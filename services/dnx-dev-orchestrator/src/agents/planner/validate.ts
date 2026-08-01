import { PlannerDecisionSchema, type PlannerDecision } from "./schema.js";
import { validateStagePlanContract } from "./prompt-contract.js";
import { evaluatePlannerDecisionSafety } from "./safety-gate.js";

export type ValidatedPlannerDecision =
  | { ok: true; decision: PlannerDecision }
  | { ok: false; reason: string; code: "SCHEMA_INVALID" | "CONTRACT_INVALID" | "SAFETY_BLOCKED" | "HUMAN_REQUIRED" };

export function validatePlannerDecision(raw: unknown): ValidatedPlannerDecision {
  const parsed = PlannerDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SCHEMA_INVALID",
      reason: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const decision = parsed.data;
  if (decision.stage) {
    const contract = validateStagePlanContract(decision.stage);
    if (!contract.ok) {
      return { ok: false, code: "CONTRACT_INVALID", reason: contract.reason };
    }
  }

  const safety = evaluatePlannerDecisionSafety(decision);
  if ("ok" in safety && safety.ok === false) {
    return {
      ok: false,
      code: safety.code === "HUMAN_REQUIRED" ? "HUMAN_REQUIRED" : "SAFETY_BLOCKED",
      reason: safety.reason,
    };
  }

  return { ok: true, decision };
}
