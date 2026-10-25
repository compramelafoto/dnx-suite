-- Etapa 8B-2 de la migración de Alboom: libro "Histórico Alboom" (FotofficeAlboomFinanza).
-- Sólo una tabla nueva. Idempotente: se puede correr dos veces. NO toca CashMovement ni CashAccount.

CREATE TABLE IF NOT EXISTS "FotofficeAlboomFinanza" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "alboomEntity" TEXT NOT NULL,
    "alboomId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountArs" DECIMAL(14,2) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "dueOn" DATE,
    "accountCode" TEXT,
    "accountName" TEXT,
    "methodName" TEXT,
    "documentNumber" TEXT,
    "alboomCategory" TEXT,
    "alboomOrderId" TEXT,
    "clientId" TEXT,
    "pedidoId" TEXT,
    "memo" TEXT,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeAlboomFinanza_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeAlboomFinanza_workspaceId_alboomEntity_alboomId_key" ON "FotofficeAlboomFinanza"("workspaceId", "alboomEntity", "alboomId");
CREATE INDEX IF NOT EXISTS "FotofficeAlboomFinanza_workspaceId_occurredOn_idx" ON "FotofficeAlboomFinanza"("workspaceId", "occurredOn");
CREATE INDEX IF NOT EXISTS "FotofficeAlboomFinanza_workspaceId_clientId_idx" ON "FotofficeAlboomFinanza"("workspaceId", "clientId");

DO $$ BEGIN
  ALTER TABLE "FotofficeAlboomFinanza" ADD CONSTRAINT "FotofficeAlboomFinanza_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeAlboomFinanza" ADD CONSTRAINT "FotofficeAlboomFinanza_source" CHECK ("source" IN ('BANCO', 'COBRO', 'A_COBRAR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeAlboomFinanza" ADD CONSTRAINT "FotofficeAlboomFinanza_kind" CHECK ("kind" IN ('INGRESO', 'EGRESO', 'TRANSFERENCIA', 'A_COBRAR', 'A_PAGAR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeAlboomFinanza" ADD CONSTRAINT "FotofficeAlboomFinanza_amountArs" CHECK ("amountArs" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
