-- Etapa 6: allocations durables por orden (settlement projection, no ledger partida doble).

CREATE TYPE "DnxPaymentOrderAllocationStatus" AS ENUM ('PENDING', 'CREATED', 'PAID', 'RECONCILED', 'REVERSED', 'FAILED');

CREATE TABLE "DnxPaymentOrderAllocation" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "distributionVersionId" TEXT NOT NULL,
    "beneficiaryUserId" INTEGER,
    "paymentAccountId" TEXT,
    "role" TEXT NOT NULL,
    "basisPoints" INTEGER NOT NULL,
    "grossAmount" BIGINT NOT NULL,
    "discountAmount" BIGINT NOT NULL,
    "chargedAmount" BIGINT NOT NULL,
    "providerFeeEstimated" BIGINT NOT NULL DEFAULT 0,
    "providerFeeConfirmed" BIGINT,
    "platformFee" BIGINT NOT NULL DEFAULT 0,
    "distributableAmountEstimated" BIGINT NOT NULL,
    "distributableAmountConfirmed" BIGINT,
    "allocationAmountEstimated" BIGINT NOT NULL,
    "allocationAmountConfirmed" BIGINT,
    "currency" TEXT NOT NULL,
    "status" "DnxPaymentOrderAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "roundingAdjustment" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPaymentOrderAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPaymentOrderAllocation_idempotencyKey_key" ON "DnxPaymentOrderAllocation"("idempotencyKey");
CREATE UNIQUE INDEX "DnxPaymentOrderAllocation_paymentOrderId_beneficiaryUserId_distributionVersionId_key" ON "DnxPaymentOrderAllocation"("paymentOrderId", "beneficiaryUserId", "distributionVersionId");
CREATE INDEX "DnxPaymentOrderAllocation_paymentOrderId_status_idx" ON "DnxPaymentOrderAllocation"("paymentOrderId", "status");
CREATE INDEX "DnxPaymentOrderAllocation_agreementId_distributionVersionId_idx" ON "DnxPaymentOrderAllocation"("agreementId", "distributionVersionId");
CREATE INDEX "DnxPaymentOrderAllocation_paymentAccountId_idx" ON "DnxPaymentOrderAllocation"("paymentAccountId");
CREATE INDEX "DnxPaymentOrderAllocation_status_idx" ON "DnxPaymentOrderAllocation"("status");
