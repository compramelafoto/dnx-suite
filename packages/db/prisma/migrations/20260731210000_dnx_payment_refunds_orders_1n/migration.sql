-- Imp 04: Orders 1:N refunds durable persistence (additive, backward-compatible).
-- Do NOT apply to production from this implementation.

CREATE TYPE "DnxPaymentRefundStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'PROCESSED', 'FAILED', 'CANCELED');

CREATE TABLE "DnxPaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "providerOrderId" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "DnxPaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "statusDetail" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "reason" TEXT,
    "environment" "DnxPaymentEnvironment" NOT NULL,
    "provider" "DnxPaymentProvider" NOT NULL DEFAULT 'MERCADOPAGO',
    "rawResponseSanitized" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentRefundAllocation" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxPaymentRefundAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPaymentRefund_provider_environment_idempotencyKey_key" ON "DnxPaymentRefund"("provider", "environment", "idempotencyKey");
CREATE INDEX "DnxPaymentRefund_paymentOrderId_status_idx" ON "DnxPaymentRefund"("paymentOrderId", "status");
CREATE INDEX "DnxPaymentRefund_providerOrderId_idx" ON "DnxPaymentRefund"("providerOrderId");
CREATE INDEX "DnxPaymentRefund_providerRefundId_idx" ON "DnxPaymentRefund"("providerRefundId");
CREATE INDEX "DnxPaymentRefundAllocation_refundId_idx" ON "DnxPaymentRefundAllocation"("refundId");
CREATE INDEX "DnxPaymentRefundAllocation_recipientId_idx" ON "DnxPaymentRefundAllocation"("recipientId");

ALTER TABLE "DnxPaymentRefundAllocation" ADD CONSTRAINT "DnxPaymentRefundAllocation_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "DnxPaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
