-- Premios que se repiten todos los meses, y el sorteo mensual que se genera solo.
-- Aditiva: dos tablas nuevas y tres columnas opcionales.

CREATE TABLE "RafflePrizeCommitment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT,
    "estimatedValueMinor" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 1,
    "partnerId" TEXT,
    "partnerNameSnapshot" TEXT,
    "partnerEmailSnapshot" TEXT,
    "partnerAddressSnapshot" TEXT,
    "partnerPhoneSnapshot" TEXT,
    "partnerHoursSnapshot" TEXT,
    "startPeriod" TEXT NOT NULL,
    "endPeriod" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RafflePrizeCommitment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RafflePrizeCommitment_workspaceId_startPeriod_idx" ON "RafflePrizeCommitment"("workspaceId", "startPeriod");
CREATE INDEX "RafflePrizeCommitment_workspaceId_cancelledAt_idx" ON "RafflePrizeCommitment"("workspaceId", "cancelledAt");
ALTER TABLE "RafflePrizeCommitment" ADD CONSTRAINT "RafflePrizeCommitment_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RaffleSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "monthlyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "drawDay" INTEGER NOT NULL DEFAULT 30,
    "drawHour" INTEGER NOT NULL DEFAULT 20,
    "entriesCloseHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "pickupDays" INTEGER NOT NULL DEFAULT 15,
    "createDaysAhead" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaffleSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RaffleSettings_workspaceId_key" ON "RaffleSettings"("workspaceId");
ALTER TABLE "RaffleSettings" ADD CONSTRAINT "RaffleSettings_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- De qué compromiso salió cada premio. El único por (sorteo, compromiso) es lo que impide
-- que la tarea mensual cargue dos veces el mismo premio si corre de más.
ALTER TABLE "RafflePrize" ADD COLUMN "commitmentId" TEXT;
CREATE UNIQUE INDEX "RafflePrize_raffleId_commitmentId_key" ON "RafflePrize"("raffleId", "commitmentId");
ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_commitmentId_fkey"
    FOREIGN KEY ("commitmentId") REFERENCES "RafflePrizeCommitment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Qué mes cubre el sorteo. Único por institución: no puede haber dos sorteos del mismo mes.
ALTER TABLE "Raffle" ADD COLUMN "period" TEXT;
CREATE UNIQUE INDEX "Raffle_workspaceId_period_key" ON "Raffle"("workspaceId", "period");
