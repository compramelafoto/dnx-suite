import type { FinancialEnvironment } from "../../financial-identity/types.js";
import type { PartnerPaymentConnectionStatus } from "../connection-states.js";
import type { PartnerOAuthPurpose } from "./config.js";

export type {
  OwnerOAuthStateRecord as PartnerOAuthStateRecord,
  OwnerPaymentAccountRecord as PartnerPaymentAccountRecord,
  OwnerFinancialIdentityRecord as PartnerFinancialIdentityRecord,
  OwnerOAuthAuditEvent as PartnerOAuthAuditEvent,
  MpTokenExchangeResult,
  MpUserLookupResult,
} from "../owner-oauth/types.js";

export type PartnerPanelViewModel = {
  status: PartnerPaymentConnectionStatus;
  environment: FinancialEnvironment | null;
  accountMasked: string | null;
  connectedAt: string | null;
  health: "unknown" | "ok" | "degraded" | "revoked";
  messages: string[];
  canConnect: boolean;
  canReconnect: boolean;
  canRevoke: boolean;
  featureEnabled: boolean;
  appConfigured: boolean;
  financialIdentityId: string | null;
  paymentAccountId: string | null;
};

export type OwnerAccountInvariantSnapshot = {
  id: string;
  status: string;
  credentialReference: string | null;
  providerUserId: string | null;
  financialIdentityId: string;
};

export class PartnerOAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PartnerOAuthError";
    this.code = code;
  }
}

export type PartnerOAuthPurposeAlias = PartnerOAuthPurpose;
