import type { FinancialEnvironment } from "../../financial-identity/types.js";
import type { PartnerPaymentConnectionStatus } from "../connection-states.js";

export type OwnerOAuthPurpose = "OWNER_CONNECTION" | "OWNER_RECONNECT";

/** OAuth state purpose — owner + partner flows share DnxMercadoPagoOAuthState. */
export type MercadoPagoOAuthPurpose = OwnerOAuthPurpose | string;

export type OwnerOAuthStateRecord = {
  id: string;
  stateHash: string;
  userId: number;
  financialIdentityId: string;
  productKey: string;
  purpose: MercadoPagoOAuthPurpose;
  environment: FinancialEnvironment;
  redirectUri: string;
  codeChallenge: string | null;
  /** AES-GCM ciphertext of PKCE verifier (never plaintext in logs). */
  codeVerifierCiphertext: string | null;
  codeVerifierNonce: string | null;
  codeVerifierAuthTag: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type OwnerPaymentAccountRecord = {
  id: string;
  financialIdentityId: string;
  provider: "MERCADOPAGO";
  environment: FinancialEnvironment;
  providerUserId: string | null;
  credentialReference: string | null;
  originApp: string | null;
  externalReference: string | null;
  tokenFingerprint: string | null;
  capabilities: Array<"COLLECTOR" | "SPLIT_RECEIVER" | "PAYOUT_DESTINATION">;
  status: "PENDING" | "ACTIVE" | "NEEDS_REAUTH" | "REVOKED" | "DISABLED";
  connectedAt: Date | null;
  verifiedAt: Date | null;
  lastHealthCheckAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OwnerFinancialIdentityRecord = {
  id: string;
  subjectType: "PERSON" | "ORGANIZATION";
  ownerUserId: number | null;
  organizationRef: string | null;
  legalName: string | null;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  countryCode: string;
};

export type OwnerOAuthAuditEvent = {
  action: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId: number | null;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  errorCode?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type MpTokenExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  providerUserId: string;
  scope: string | null;
};

export type MpUserLookupResult = {
  providerUserId: string;
  nicknameMasked: string | null;
  emailMasked: string | null;
};

export type OwnerPanelViewModel = {
  status: PartnerPaymentConnectionStatus;
  environment: "PROD" | "TEST" | null;
  accountMasked: string | null;
  connectedAt: string | null;
  verifiedAt: string | null;
  lastHealthCheckAt: string | null;
  scopes: string[];
  health: "unknown" | "ok" | "degraded" | "revoked";
  messages: string[];
  canConnect: boolean;
  canReconnect: boolean;
  canRevoke: boolean;
  liveOAuthAuthorized: boolean;
  onboardingFlagEnabled: boolean;
  appConfigured: boolean;
};

export class OwnerOAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OwnerOAuthError";
    this.code = code;
  }
}
