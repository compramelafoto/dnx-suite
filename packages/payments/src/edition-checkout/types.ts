/**
 * Snapshot financiero inmutable para crear checkout Clickatón (Etapa 6).
 * Unidades: mismas que `amountMinor` del dominio (ARS = centavos).
 * Nunca incluir tokens/secretos.
 */

export const EDITION_CHECKOUT_BPS_TOTAL = 10_000;

export type EditionCheckoutFeePolicy = {
  /** Tammy 100% del importe distribuible tras fees del PSP. */
  distributableBase: "AFTER_PROVIDER_FEE";
  platformFeeAmount: number;
};

export type EditionCheckoutSnapshotAllocation = {
  beneficiaryUserId: number | null;
  beneficiaryDisplayName: string;
  paymentAccountId: string;
  paymentProvider: string;
  accountEnvironment: "TEST" | "LIVE" | string;
  role: string;
  shareType: "PERCENTAGE";
  /** 0–100 UI helper; fuente de verdad = basisPoints. */
  shareValue: number;
  basisPoints: number;
  allocationAmount: number;
  roundingAdjustment: number;
};

export type EditionCheckoutFinanceSnapshot = {
  schemaVersion: 2;
  agreementId: string;
  distributionVersionId: string;
  distributionVersionNumber: number;
  currency: string;
  grossAmount: number;
  discountAmount: number;
  chargedAmount: number;
  /** Estimación previa al pago; puede ser 0 si desconocida. */
  providerFeeEstimated: number;
  providerFeeConfirmed?: number | null;
  platformFee: number;
  distributableAmount: number;
  feePolicy: EditionCheckoutFeePolicy | string | null;
  roundingPolicy: string;
  allocations: EditionCheckoutSnapshotAllocation[];
  createdAt: string;
};

export type PlannedEditionAllocation = {
  beneficiaryUserId: number | null;
  paymentAccountId: string;
  role: string;
  basisPoints: number;
  allocationAmountEstimated: number;
  roundingAdjustment: number;
  beneficiaryDisplayName: string;
  accountEnvironment: string;
  paymentProvider: string;
};

export type PlannedEditionCheckout = {
  snapshot: EditionCheckoutFinanceSnapshot;
  distributableAmountEstimated: number;
  providerFeeEstimated: number;
  platformFee: number;
  allocations: PlannedEditionAllocation[];
  /** Cuenta collector para Checkout Pro (N=1 OAuth). */
  collectorPaymentAccountId: string;
  modality: "CHECKOUT_PRO_COLLECTOR_OAUTH" | "ORDERS_1N_SPLIT" | "MANUAL_SIMULATED";
};
