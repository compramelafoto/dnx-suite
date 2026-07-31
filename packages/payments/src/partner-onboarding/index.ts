export type { PartnerPaymentConnectionStatus, PartnerConnectionTransition } from "./connection-states.js";
export {
  PARTNER_CONNECTION_TRANSITIONS,
  FORBIDDEN_PARTNER_CONNECTION_TRANSITIONS,
  canTransitionPartnerConnection,
} from "./connection-states.js";

export type {
  ClickatonPartnerKey,
  PartnerPermissionAction,
  PartnerActorRole,
  MpScopeClass,
  MpScopeRequirement,
  PartnerOnboardingAuditAction,
} from "./governance.js";
export {
  CLICKATON_PRODUCTION_AGREEMENT_SCOPE,
  CLICKATON_STAGING_TEST_AGREEMENT_SCOPE,
  CLICKATON_PARTNER_KEYS,
  CLICKATON_PRODUCTION_TARGET_BPS,
  PARTNER_PERMISSION_MATRIX,
  CLICKATON_MP_SCOPE_REQUIREMENTS,
  canPartnerPerform,
} from "./governance.js";

export type {
  ReadinessGateId,
  ClickatonProductionPaymentReadinessInput,
  ClickatonProductionPaymentReadinessResult,
  ReadinessGateRow,
} from "./readiness.js";
export {
  createEmptyProductionReadinessInput,
  createSimulatedCompleteReadinessInput,
  evaluateClickatonProductionPaymentReadiness,
} from "./readiness.js";

export {
  PARTNER_ACCOUNT_UI_MESSAGES,
  FINANCE_PANEL_UI_MESSAGES,
} from "./ui-messages.js";

export * from "./owner-oauth/index.js";
export * from "./partner-oauth/index.js";
