/**
 * Vista de dominio Clickatón sobre DnxEconomicAgreement / Version / Rules.
 * No duplica tablas: EditionFinancial* es el contrato de aplicación.
 */

export type EditionFinancialDistributionStatus = "DRAFT" | "ACTIVE" | "SUPERSEDED";

export type EditionFinancialShareType = "PERCENTAGE";

export type PaymentConnectionView = {
  id: string;
  provider: string;
  environment: "TEST" | "LIVE" | string;
  status: string;
  providerUserId: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  canReceivePayments: boolean;
};

export type EditionFinancialAllocationView = {
  id: string;
  beneficiaryUserId: number | null;
  beneficiaryDisplayName: string;
  beneficiaryEmailMasked: string | null;
  financialIdentityId: string;
  paymentConnectionId: string | null;
  paymentConnection: PaymentConnectionView | null;
  role: string;
  shareType: EditionFinancialShareType;
  /** Porcentaje 0–100 (UI). Internamente se persiste en bps. */
  shareValue: number;
  shareBps: number;
  sortOrder: number;
  participantStatus: string;
};

export type EditionFinancialDistributionView = {
  /** agreementId */
  id: string;
  editionId: string;
  versionId: string | null;
  version: number;
  status: EditionFinancialDistributionStatus;
  versionStatus: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  agreementStatus: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdByUserId: number;
  activatedByUserId: number | null;
  activatedAt: Date | null;
  feePolicy: string | null;
  roundingPolicy: string;
  allocations: EditionFinancialAllocationView[];
  createdAt: Date;
  updatedAt: Date;
};

export type EditionFinanceAuditView = {
  id: string;
  editionId: string;
  action: string;
  actorUserId: number | null;
  agreementId: string | null;
  versionId: string | null;
  previousValue: unknown;
  nextValue: unknown;
  metadata: unknown;
  createdAt: Date;
};

export type OrderFinanceSnapshotAllocation = {
  beneficiaryUserId: number | null;
  beneficiaryDisplayName: string;
  /** Alias estable: paymentAccountId (DNX). */
  paymentConnectionId: string | null;
  paymentAccountId: string | null;
  paymentProvider: string | null;
  accountEnvironment: "TEST" | "LIVE" | string | null;
  role: string;
  shareType: EditionFinancialShareType;
  shareValue: number;
  shareBps: number;
  /** Alias de shareBps para contrato edition-checkout. */
  basisPoints: number;
  allocationAmount: number;
  roundingAdjustment: number;
};

/**
 * Snapshot inmutable v2 — unidades = amountMinor del dominio (ARS centavos).
 * Sin tokens/secretos.
 */
export type OrderFinanceSnapshot = {
  schemaVersion: 2;
  /** Alias agreementId */
  distributionId: string;
  agreementId: string;
  distributionVersionId: string;
  distributionVersion: number;
  distributionVersionNumber: number;
  currency: string;
  grossAmount: number;
  discountAmount: number;
  chargedAmount: number;
  /** @deprecated prefer providerFeeEstimated */
  providerFee: number;
  providerFeeEstimated: number;
  providerFeeConfirmed?: number | null;
  platformFee: number;
  distributableAmount: number;
  feePolicy: string | null;
  roundingPolicy: string;
  allocations: OrderFinanceSnapshotAllocation[];
  createdAt: string;
};

export type CommercialFinanceGateResult = {
  ok: boolean;
  mode: "TEST" | "LIVE" | "UNKNOWN";
  blockers: string[];
  warnings: string[];
  distribution: EditionFinancialDistributionView | null;
};
