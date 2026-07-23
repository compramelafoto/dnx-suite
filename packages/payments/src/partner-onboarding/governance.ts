/**
 * Governance constants for Clickatón real MP partner onboarding (10D3I-I0).
 * No live credentials. Percentages are NOT owned by OAuth/PaymentAccount.
 */

export const CLICKATON_PRODUCTION_AGREEMENT_SCOPE = {
  productKey: "clickaton",
  scopeType: "PRODUCT",
  scopeId: "partners-production",
} as const;

/** Staging TEST scope remains untouched (10D3I-E). */
export const CLICKATON_STAGING_TEST_AGREEMENT_SCOPE = {
  productKey: "clickaton",
  scopeType: "STAGING_TEST",
  scopeId: "partners-10d3i-e",
} as const;

export const CLICKATON_PARTNER_KEYS = ["dani", "rodri", "tammy"] as const;
export type ClickatonPartnerKey = (typeof CLICKATON_PARTNER_KEYS)[number];

/**
 * Target productive BPS (same as validated TEST). Changing this requires a new
 * DistributionVersion published by finance authority — never by a partner UI.
 */
export const CLICKATON_PRODUCTION_TARGET_BPS = {
  dani: 3400,
  rodri: 3300,
  tammy: 3300,
} as const;

export type PartnerPermissionAction =
  | "connect_own_account"
  | "view_own_status"
  | "view_full_receiver_id"
  | "view_access_token"
  | "modify_percentages"
  | "publish_distribution_version"
  | "activate_production"
  | "revoke_own_account"
  | "revoke_other_account"
  | "view_own_settlements"
  | "view_global_settlements";

export type PartnerActorRole =
  | "DANIEL_PARTNER"
  | "RODRIGO_PARTNER"
  | "TAMARA_PARTNER"
  | "DNX_FINANCE_OWNER"
  | "SYSTEM";

/**
 * Matrix: who may perform what. Tokens / full receiver IDs are never UI-visible.
 * Percentages and production activation stay with finance authority + system gates.
 */
export const PARTNER_PERMISSION_MATRIX: Record<
  PartnerPermissionAction,
  Record<PartnerActorRole, boolean>
> = {
  connect_own_account: {
    DANIEL_PARTNER: true,
    RODRIGO_PARTNER: true,
    TAMARA_PARTNER: true,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  view_own_status: {
    DANIEL_PARTNER: true,
    RODRIGO_PARTNER: true,
    TAMARA_PARTNER: true,
    DNX_FINANCE_OWNER: true,
    SYSTEM: true,
  },
  view_full_receiver_id: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: false,
    SYSTEM: true,
  },
  view_access_token: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: false,
    SYSTEM: false,
  },
  modify_percentages: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  publish_distribution_version: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  activate_production: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  revoke_own_account: {
    DANIEL_PARTNER: true,
    RODRIGO_PARTNER: true,
    TAMARA_PARTNER: true,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  revoke_other_account: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: true,
    SYSTEM: false,
  },
  view_own_settlements: {
    DANIEL_PARTNER: true,
    RODRIGO_PARTNER: true,
    TAMARA_PARTNER: true,
    DNX_FINANCE_OWNER: true,
    SYSTEM: true,
  },
  view_global_settlements: {
    DANIEL_PARTNER: false,
    RODRIGO_PARTNER: false,
    TAMARA_PARTNER: false,
    DNX_FINANCE_OWNER: true,
    SYSTEM: true,
  },
};

export function canPartnerPerform(
  role: PartnerActorRole,
  action: PartnerPermissionAction,
): boolean {
  return PARTNER_PERMISSION_MATRIX[action][role] === true;
}

/**
 * Minimum OAuth scopes for DNX Payments partner onboarding.
 * MP may not expose named scopes in URL today (CLF legacy sends none) —
 * I1+ must negotiate explicit least-privilege scopes with the MP app.
 */
export type MpScopeClass = "obligatorio" | "opcional" | "innecesario" | "riesgoso";

export type MpScopeRequirement = {
  id: string;
  classification: MpScopeClass;
  rationale: string;
};

export const CLICKATON_MP_SCOPE_REQUIREMENTS: readonly MpScopeRequirement[] = [
  {
    id: "offline_access",
    classification: "obligatorio",
    rationale: "Refresh token for durable server-side reconciliation without re-prompt.",
  },
  {
    id: "read",
    classification: "obligatorio",
    rationale: "Identify provider user / account id server-to-server after OAuth.",
  },
  {
    id: "write",
    classification: "opcional",
    rationale: "Only if Orders create must use partner-delegated credentials; prefer owner token + receivers.",
  },
  {
    id: "payments",
    classification: "opcional",
    rationale: "Needed only if reading payment resources under the partner seller context.",
  },
  {
    id: "wallet_balance",
    classification: "innecesario",
    rationale: "Not required for split receive / consent / reconciliation.",
  },
  {
    id: "full_admin",
    classification: "riesgoso",
    rationale: "Over-privileged; never request.",
  },
] as const;

export type PartnerOnboardingAuditAction =
  | "OAUTH_STARTED"
  | "OAUTH_CALLBACK_RECEIVED"
  | "ACCOUNT_CONNECTED"
  | "ACCOUNT_VERIFIED"
  | "CONSENT_GRANTED"
  | "CONSENT_REVOKED"
  | "TOKEN_REFRESHED"
  | "ACCOUNT_RECONNECTED"
  | "ACCOUNT_REVOKED"
  | "DISTRIBUTION_READY"
  | "DISTRIBUTION_BLOCKED"
  | "VERSION_PUBLISHED";
