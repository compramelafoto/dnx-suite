import type {
  SafetyAction,
  SafetyClassification,
  SafetyContext,
  SafetyEvaluation,
} from "./types.js";

const POLICY: Record<SafetyAction, SafetyClassification> = {
  READ_REPO: "SAFE_AUTOMATIC",
  CURSOR_ASK: "SAFE_AUTOMATIC",
  RUN_TESTS: "SAFE_AUTOMATIC",
  EDIT_WORKTREE: "SAFE_WITH_LIMITS",
  LOCAL_COMMIT: "SAFE_WITH_LIMITS",
  PUSH: "HUMAN_APPROVAL_REQUIRED",
  MERGE: "HUMAN_APPROVAL_REQUIRED",
  DEPLOY_STAGING: "HUMAN_APPROVAL_REQUIRED",
  CREATE_PR: "HUMAN_APPROVAL_REQUIRED",
  NON_DESTRUCTIVE_MIGRATION: "HUMAN_APPROVAL_REQUIRED",
  DEPLOY_PRODUCTION: "FORBIDDEN_AUTOMATIC",
  DROP_DATABASE: "FORBIDDEN_AUTOMATIC",
  TRUNCATE_DATABASE: "FORBIDDEN_AUTOMATIC",
  PROD_DATA_WRITE: "FORBIDDEN_AUTOMATIC",
  CHANGE_DNS: "FORBIDDEN_AUTOMATIC",
  CLOUDFLARE_PROD_CHANGE: "FORBIDDEN_AUTOMATIC",
  MERCADO_PAGO_PROD_CHANGE: "FORBIDDEN_AUTOMATIC",
  OAUTH_PROD_CHANGE: "FORBIDDEN_AUTOMATIC",
  SECRET_ROTATION: "FORBIDDEN_AUTOMATIC",
  FORCE_PUSH: "FORBIDDEN_AUTOMATIC",
  RESET_HARD: "FORBIDDEN_AUTOMATIC",
  MASS_DELETE: "FORBIDDEN_AUTOMATIC",
};

const DEFAULT_CONTEXT: SafetyContext = {
  writeExecutionEnabled: false,
};

export function getSafetyMatrix(): Array<{
  action: SafetyAction;
  classification: SafetyClassification;
}> {
  return (Object.keys(POLICY) as SafetyAction[]).map((action) => ({
    action,
    classification: POLICY[action],
  }));
}

export function evaluateAction(
  action: SafetyAction,
  context: SafetyContext = DEFAULT_CONTEXT,
): SafetyEvaluation {
  const classification = POLICY[action];

  if (classification === "FORBIDDEN_AUTOMATIC") {
    return {
      action,
      classification,
      allowed: false,
      requiresHumanApproval: true,
      reason: "Forbidden for automatic execution under DNX orchestrator safety policy.",
    };
  }

  if (classification === "HUMAN_APPROVAL_REQUIRED") {
    return {
      action,
      classification,
      allowed: false,
      requiresHumanApproval: true,
      reason: "Requires explicit human approval before any execution.",
    };
  }

  if (classification === "SAFE_WITH_LIMITS") {
    if (!context.writeExecutionEnabled) {
      return {
        action,
        classification,
        allowed: false,
        requiresHumanApproval: true,
        reason:
          "SAFE_WITH_LIMITS is blocked while write execution is disabled (ETAPA 01 foundation / read-only).",
      };
    }
    return {
      action,
      classification,
      allowed: true,
      requiresHumanApproval: false,
      reason: "Allowed with limits when write execution is explicitly enabled.",
    };
  }

  // SAFE_AUTOMATIC
  return {
    action,
    classification,
    allowed: true,
    requiresHumanApproval: false,
    reason: "Read-only / non-destructive automatic action.",
  };
}
