-- Números reales por edición de Clickatón: gastos, sobrante contado y comisiones de MP.
-- Sólo crea tablas nuevas; no toca datos existentes.

CREATE TABLE IF NOT EXISTS "ClickatonEditionExpense" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTRO',
    "amountMinor" INTEGER NOT NULL,
    "paidBy" TEXT,
    "spentAt" TIMESTAMP(3),
    "isEstimate" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonEditionExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClickatonEditionLeftoverItem" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "detail" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCostMinor" INTEGER,
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,
    "carriedToEditionId" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonEditionLeftoverItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClickatonEditionResultSettings" (
    "editionId" TEXT NOT NULL,
    "mpProcessingFeeBps" INTEGER,
    "mpWithdrawalFeeBps" INTEGER,
    "mpFeesActualMinor" INTEGER,
    "notes" TEXT,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonEditionResultSettings_pkey" PRIMARY KEY ("editionId")
);

CREATE INDEX IF NOT EXISTS "ClickatonEditionExpense_editionId_createdAt_idx" ON "ClickatonEditionExpense"("editionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonEditionLeftoverItem_editionId_idx" ON "ClickatonEditionLeftoverItem"("editionId");
CREATE INDEX IF NOT EXISTS "ClickatonEditionLeftoverItem_carriedToEditionId_idx" ON "ClickatonEditionLeftoverItem"("carriedToEditionId");

ALTER TABLE "ClickatonEditionExpense" ADD CONSTRAINT "ClickatonEditionExpense_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClickatonEditionLeftoverItem" ADD CONSTRAINT "ClickatonEditionLeftoverItem_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClickatonEditionLeftoverItem" ADD CONSTRAINT "ClickatonEditionLeftoverItem_carriedToEditionId_fkey" FOREIGN KEY ("carriedToEditionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClickatonEditionResultSettings" ADD CONSTRAINT "ClickatonEditionResultSettings_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
