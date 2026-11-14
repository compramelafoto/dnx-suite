-- CLF internacional, piloto: saldo en dólares del fotógrafo y cotizaciones diarias.
-- Cambio solo aditivo: crea dos tablas nuevas. Se puede repetir sin efectos.
CREATE TABLE IF NOT EXISTS "ClfIntlWalletMovement" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "amountUsdCents" INTEGER NOT NULL,
  "orderId" INTEGER,
  "externalRef" TEXT,
  "localCurrency" TEXT,
  "localAmount" INTEGER,
  "fxUnitsPerUsd" TEXT,
  "fxRateId" TEXT,
  "note" TEXT,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClfIntlWalletMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClfIntlWalletMovement_orderId_type_key" ON "ClfIntlWalletMovement"("orderId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "ClfIntlWalletMovement_externalRef_key" ON "ClfIntlWalletMovement"("externalRef");
CREATE INDEX IF NOT EXISTS "ClfIntlWalletMovement_userId_createdAt_idx" ON "ClfIntlWalletMovement"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "ClfFxRate" (
  "id" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "unitsPerUsdBuy" TEXT NOT NULL,
  "unitsPerUsdSell" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "effectiveDate" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClfFxRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClfFxRate_currency_effectiveDate_source_key" ON "ClfFxRate"("currency", "effectiveDate", "source");
