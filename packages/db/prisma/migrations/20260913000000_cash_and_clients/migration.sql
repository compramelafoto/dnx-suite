-- Etapa 1a: Caja y Clientes. Puramente aditiva — seis tablas nuevas, ninguna columna
-- existente modificada, ningún enum nuevo (el esquema lo comparten cinco aplicaciones).

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERSONA',
    "firstName" TEXT,
    "lastName" TEXT,
    "businessName" TEXT,
    "docType" TEXT,
    "docNumber" TEXT,
    "ivaCondition" TEXT NOT NULL DEFAULT 'CONSUMIDOR_FINAL',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "memberId" TEXT,
    "userId" INTEGER,
    "consentsMarketing" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Client_memberId_key" ON "Client"("memberId");
CREATE UNIQUE INDEX "Client_workspaceId_clientNumber_key" ON "Client"("workspaceId", "clientNumber");
CREATE INDEX "Client_workspaceId_status_idx" ON "Client"("workspaceId", "status");
CREATE INDEX "Client_workspaceId_docNumber_idx" ON "Client"("workspaceId", "docNumber");
CREATE INDEX "Client_workspaceId_email_idx" ON "Client"("workspaceId", "email");
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "isVault" BOOLEAN NOT NULL DEFAULT false,
    "fixedFloatArs" DECIMAL(12,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashAccount_workspaceId_name_key" ON "CashAccount"("workspaceId", "name");
CREATE INDEX "CashAccount_workspaceId_isActive_idx" ON "CashAccount"("workspaceId", "isActive");
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CashCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashCategory_workspaceId_kind_name_key" ON "CashCategory"("workspaceId", "kind", "name");
CREATE INDEX "CashCategory_workspaceId_kind_isActive_idx" ON "CashCategory"("workspaceId", "kind", "isActive");
ALTER TABLE "CashCategory" ADD CONSTRAINT "CashCategory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CashTransfer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashTransfer_workspaceId_occurredAt_idx" ON "CashTransfer"("workspaceId", "occurredAt");
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_fromAccountId_fkey"
    FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedByUserId" INTEGER,
    "openingAmountArs" DECIMAL(12,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" INTEGER,
    "countedAmountArs" DECIMAL(12,2),
    "expectedAmountArs" DECIMAL(12,2),
    "differenceArs" DECIMAL(12,2),
    "differenceNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashShift_workspaceId_openedAt_idx" ON "CashShift"("workspaceId", "openedAt");
CREATE INDEX "CashShift_accountId_status_idx" ON "CashShift"("accountId", "status");
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La regla "un solo turno abierto por cuenta" vive en la base y no sólo en el código.
-- Prisma no sabe expresar un índice único parcial en el esquema, así que se crea acá: sin
-- esto, dos personas abriendo caja al mismo tiempo dejan dos turnos abiertos y el arqueo
-- pierde sentido. Es el mismo criterio que `Booking_sin_solapamiento`.
CREATE UNIQUE INDEX "CashShift_un_turno_abierto_por_cuenta"
    ON "CashShift"("accountId") WHERE "status" = 'ABIERTO';

CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shiftId" TEXT,
    "kind" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "clientId" TEXT,
    "description" TEXT NOT NULL,
    "receiptRef" TEXT,
    "sourceModule" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "reversesMovementId" TEXT,
    "reverseReason" TEXT,
    "transferId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashMovement_reversesMovementId_key" ON "CashMovement"("reversesMovementId");
CREATE UNIQUE INDEX "CashMovement_sourceModule_sourceRef_key" ON "CashMovement"("sourceModule", "sourceRef");
CREATE INDEX "CashMovement_workspaceId_occurredAt_idx" ON "CashMovement"("workspaceId", "occurredAt");
CREATE INDEX "CashMovement_accountId_occurredAt_idx" ON "CashMovement"("accountId", "occurredAt");
CREATE INDEX "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");
CREATE INDEX "CashMovement_clientId_occurredAt_idx" ON "CashMovement"("clientId", "occurredAt");
CREATE INDEX "CashMovement_transferId_idx" ON "CashMovement"("transferId");
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_reversesMovementId_fkey"
    FOREIGN KEY ("reversesMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "CashTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
