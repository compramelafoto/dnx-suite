-- Contador de billetes de Caja: la foto de cada conteo, para auditar.
-- Sólo agrega una tabla: no toca ninguna existente.
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shiftId" TEXT,
    "denominations" JSONB NOT NULL,
    "countedAmountArs" DECIMAL(12,2) NOT NULL,
    "expectedAmountArs" DECIMAL(12,2),
    "differenceArs" DECIMAL(12,2),
    "floatAmountArs" DECIMAL(12,2) NOT NULL,
    "toVaultAmountArs" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "transferId" TEXT,
    "adjustmentMovementId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashCount_workspaceId_createdAt_idx" ON "CashCount"("workspaceId", "createdAt");
CREATE INDEX "CashCount_accountId_createdAt_idx" ON "CashCount"("accountId", "createdAt");
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
