export const SAFETY_CLASSIFICATIONS = [
  "SAFE_AUTOMATIC",
  "SAFE_WITH_LIMITS",
  "HUMAN_APPROVAL_REQUIRED",
  "FORBIDDEN_AUTOMATIC",
] as const;

export type SafetyClassification = (typeof SAFETY_CLASSIFICATIONS)[number];

export const SAFETY_ACTIONS = [
  "READ_REPO",
  "CURSOR_ASK",
  "RUN_TESTS",
  "EDIT_WORKTREE",
  "LOCAL_COMMIT",
  "PUSH",
  "MERGE",
  "DEPLOY_STAGING",
  "CREATE_PR",
  "NON_DESTRUCTIVE_MIGRATION",
  "DEPLOY_PRODUCTION",
  "DROP_DATABASE",
  "TRUNCATE_DATABASE",
  "PROD_DATA_WRITE",
  "CHANGE_DNS",
  "CLOUDFLARE_PROD_CHANGE",
  "MERCADO_PAGO_PROD_CHANGE",
  "OAUTH_PROD_CHANGE",
  "SECRET_ROTATION",
  "FORCE_PUSH",
  "RESET_HARD",
  "MASS_DELETE",
] as const;

export type SafetyAction = (typeof SAFETY_ACTIONS)[number];

export type SafetyEvaluation = {
  action: SafetyAction;
  classification: SafetyClassification;
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason: string;
};

export type SafetyContext = {
  /** When false (ETAPA 01 default), SAFE_WITH_LIMITS cannot execute. */
  writeExecutionEnabled: boolean;
};
