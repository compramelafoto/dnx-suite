import type { FinancialEnvironment } from "../financial-identity/types.js";
import type { PaymentAccountCapability } from "../financial-identity/types.js";

export type MpCredentialSource =
  | "legacy_user"
  | "legacy_lab"
  | "financial_identity"
  | "conflict_blocked";

export interface ResolvedMercadoPagoAccount {
  ok: true;
  accessToken: string;
  mpUserId: string | null;
  source: Exclude<MpCredentialSource, "conflict_blocked">;
  environment: FinancialEnvironment;
  paymentAccountId: string | null;
  financialIdentityId: string | null;
  usedLegacyFallback: boolean;
}

export interface ResolveMercadoPagoAccountFailure {
  ok: false;
  code:
    | "NOT_FOUND"
    | "CONFLICT"
    | "DECRYPT_FAILED"
    | "DISABLED"
    | "MODE_UNSUPPORTED";
  message: string;
  source: MpCredentialSource;
}

export type ResolveMercadoPagoAccountResult =
  | ResolvedMercadoPagoAccount
  | ResolveMercadoPagoAccountFailure;

export interface LegacyUserMpRow {
  userId: number;
  mpUserId: string | null;
  mpAccessToken: string | null;
  mpRefreshToken: string | null;
  mpConnectedAt: Date | null;
}

export interface LegacyLabMpRow {
  labId: number;
  ownerUserId: number | null;
  name: string;
  country: string | null;
  mpUserId: string | null;
  mpAccessToken: string | null;
  mpRefreshToken: string | null;
  mpConnectedAt: Date | null;
}

export interface DualReadPorts {
  loadLegacyUserMp(userId: number): Promise<LegacyUserMpRow | null>;
  loadLegacyLabMp(labId: number): Promise<LegacyLabMpRow | null>;
  findActivePaymentAccountForUser(input: {
    userId: number;
    environment: FinancialEnvironment;
    requiredCapability?: PaymentAccountCapability;
  }): Promise<{
    paymentAccountId: string;
    financialIdentityId: string;
    providerUserId: string | null;
    credentialReference: string | null;
    status: string;
  } | null>;
  findActivePaymentAccountForLab(input: {
    labId: number;
    environment: FinancialEnvironment;
  }): Promise<{
    paymentAccountId: string;
    financialIdentityId: string;
    providerUserId: string | null;
    credentialReference: string | null;
    status: string;
  } | null>;
  decryptCredential(
    credentialReference: string,
  ): Promise<{ accessToken: string; providerUserId: string }>;
  recordAudit?(event: {
    action: string;
    aggregateType: string;
    aggregateId: string;
    result: "SUCCEEDED" | "FAILED" | "DENIED";
    metadata?: Record<string, unknown>;
  }): void;
}
