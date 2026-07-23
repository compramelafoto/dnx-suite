/**
 * Partner Mercado Pago onboarding — connection lifecycle (10D3I-I0).
 * Design-only states for production path; no live OAuth in this stage.
 */

export type PartnerPaymentConnectionStatus =
  | "NOT_CONNECTED"
  | "OAUTH_PENDING"
  | "CONNECTED_UNVERIFIED"
  | "VERIFIED"
  | "CONSENT_PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "ERROR"
  | "DISABLED";

export type PartnerConnectionTransition = {
  from: PartnerPaymentConnectionStatus;
  to: PartnerPaymentConnectionStatus;
  trigger: string;
};

/** Canonical allowed transitions for partner / owner payment accounts. */
export const PARTNER_CONNECTION_TRANSITIONS: readonly PartnerConnectionTransition[] = [
  { from: "NOT_CONNECTED", to: "OAUTH_PENDING", trigger: "oauth_start" },
  { from: "OAUTH_PENDING", to: "CONNECTED_UNVERIFIED", trigger: "oauth_callback_ok" },
  { from: "OAUTH_PENDING", to: "ERROR", trigger: "oauth_callback_fail" },
  { from: "OAUTH_PENDING", to: "NOT_CONNECTED", trigger: "oauth_state_expired" },
  { from: "CONNECTED_UNVERIFIED", to: "VERIFIED", trigger: "s2s_account_verified" },
  { from: "CONNECTED_UNVERIFIED", to: "ERROR", trigger: "s2s_account_mismatch" },
  { from: "VERIFIED", to: "CONSENT_PENDING", trigger: "consent_required" },
  { from: "VERIFIED", to: "ACTIVE", trigger: "consent_already_active" },
  { from: "CONSENT_PENDING", to: "ACTIVE", trigger: "consent_granted" },
  { from: "ACTIVE", to: "EXPIRED", trigger: "token_or_consent_expired" },
  { from: "ACTIVE", to: "REVOKED", trigger: "user_or_provider_revoke" },
  { from: "EXPIRED", to: "OAUTH_PENDING", trigger: "reconnect_start" },
  { from: "REVOKED", to: "OAUTH_PENDING", trigger: "reconnect_start" },
  { from: "ERROR", to: "OAUTH_PENDING", trigger: "retry_start" },
  { from: "ACTIVE", to: "DISABLED", trigger: "finance_admin_disable" },
  { from: "DISABLED", to: "OAUTH_PENDING", trigger: "finance_admin_reenable_reconnect" },
] as const;

export function canTransitionPartnerConnection(
  from: PartnerPaymentConnectionStatus,
  to: PartnerPaymentConnectionStatus,
): boolean {
  return PARTNER_CONNECTION_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/** Invalid examples used in tests / docs (not exhaustive). */
export const FORBIDDEN_PARTNER_CONNECTION_TRANSITIONS: readonly PartnerConnectionTransition[] = [
  { from: "NOT_CONNECTED", to: "ACTIVE", trigger: "skip_oauth" },
  { from: "REVOKED", to: "ACTIVE", trigger: "reactivate_without_oauth" },
  { from: "ACTIVE", to: "NOT_CONNECTED", trigger: "silent_unlink" },
] as const;
