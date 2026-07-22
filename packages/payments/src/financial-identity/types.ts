export type FinancialSubjectType = "PERSON" | "ORGANIZATION";

export type FinancialIdentityStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export type FinancialEnvironment = "TEST" | "PROD";

export type PaymentAccountStatus =
  | "PENDING"
  | "ACTIVE"
  | "NEEDS_REAUTH"
  | "REVOKED"
  | "DISABLED";

export type PaymentAccountCapability =
  | "COLLECTOR"
  | "SPLIT_RECEIVER"
  | "PAYOUT_DESTINATION";

/** Providers persisted today; Stripe/bank reserved for later stages. */
export type FinancialProvider =
  | "MERCADOPAGO"
  | "MERCADOPAGO_PREFERENCES_LEGACY"
  | "STRIPE"
  | "PAYPAL"
  | "TRANSFER"
  | "MANUAL"
  | "OTHER";

export interface FinancialIdentity {
  id: string;
  subjectType: FinancialSubjectType;
  ownerUserId: number | null;
  isPrimary: boolean;
  organizationRef: string | null;
  legalName: string | null;
  taxId: string | null;
  countryCode: string;
  status: FinancialIdentityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAccount {
  id: string;
  financialIdentityId: string;
  provider: FinancialProvider;
  environment: FinancialEnvironment;
  providerUserId: string | null;
  externalReference: string | null;
  /** Opaque vault pointer — never a raw PSP token. */
  credentialReference: string | null;
  consentReference: string | null;
  originApp: string | null;
  legacySource: string | null;
  tokenFingerprint: string | null;
  connectedAt: Date | null;
  capabilities: PaymentAccountCapability[];
  isPrimary: boolean;
  status: PaymentAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Public view — strips credentialReference and token fingerprint. */
export type PublicPaymentAccount = Omit<
  PaymentAccount,
  "credentialReference" | "tokenFingerprint"
> & {
  hasCredentialReference: boolean;
};

export function toPublicPaymentAccount(account: PaymentAccount): PublicPaymentAccount {
  const { credentialReference, tokenFingerprint: _fp, ...rest } = account;
  return {
    ...rest,
    hasCredentialReference: Boolean(credentialReference),
  };
}

export function mapFinancialEnvToPayments(
  env: FinancialEnvironment,
): "SANDBOX" | "PRODUCTION" {
  return env === "TEST" ? "SANDBOX" : "PRODUCTION";
}
