-- Finanzas DNX: gastos automáticos desde Gmail (Tanda 1). Idempotente.

-- Un proveedor puede tener varias facturas en un mes.
DROP INDEX IF EXISTS "ExpenseEntry_vendorId_periodYear_periodMonth_key";
CREATE INDEX IF NOT EXISTS "ExpenseEntry_vendorId_periodYear_periodMonth_idx"
  ON "ExpenseEntry"("vendorId", "periodYear", "periodMonth");

ALTER TABLE "ExpenseEntry" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "ExpenseEntry" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseEntry_vendorId_invoiceNumber_key"
  ON "ExpenseEntry"("vendorId", "invoiceNumber");

CREATE TABLE IF NOT EXISTS "ExpenseMailAccount" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAlertedAt" TIMESTAMP(3),
    "backfillDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseMailAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseMailAccount_email_key" ON "ExpenseMailAccount"("email");

CREATE TABLE IF NOT EXISTS "ExpenseMailMessage" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyText" TEXT NOT NULL,
    "vendorKey" TEXT,
    "kind" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "invoiceNumber" TEXT,
    "periodYear" INTEGER,
    "periodMonth" INTEGER,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PARA_REVISAR',
    "reviewReason" TEXT,
    "entryId" INTEGER,
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseMailMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseMailMessage_gmailMessageId_key" ON "ExpenseMailMessage"("gmailMessageId");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_status_idx" ON "ExpenseMailMessage"("status");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_accountId_receivedAt_idx" ON "ExpenseMailMessage"("accountId", "receivedAt");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_vendorKey_idx" ON "ExpenseMailMessage"("vendorKey");

DO $$ BEGIN
  ALTER TABLE "ExpenseMailMessage" ADD CONSTRAINT "ExpenseMailMessage_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "ExpenseMailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseMailMessage" ADD CONSTRAINT "ExpenseMailMessage_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "ExpenseEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
