-- Clickatón refunds Imp-01: espejo financiero de devoluciones (aditivo, no destructivo).
ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "refundedAmountMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastProviderRefundId" TEXT;

CREATE INDEX IF NOT EXISTS "ClickatonRegistration_providerPaymentId_idx"
  ON "ClickatonRegistration"("providerPaymentId");
