-- AlterTable
ALTER TABLE "GovAttachment" ADD COLUMN     "quoteId" TEXT;

-- CreateTable
CREATE TABLE "GovQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "discardReason" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovReservation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "meetingId" TEXT,
    "createdByUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectMovement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "quoteId" TEXT,
    "cashMovementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovProjectMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovQuote_projectId_stageId_idx" ON "GovQuote"("projectId", "stageId");

-- CreateIndex
CREATE INDEX "GovReservation_projectId_createdAt_idx" ON "GovReservation"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovProjectMovement_cashMovementId_key" ON "GovProjectMovement"("cashMovementId");

-- CreateIndex
CREATE INDEX "GovProjectMovement_projectId_idx" ON "GovProjectMovement"("projectId");

-- AddForeignKey
ALTER TABLE "GovAttachment" ADD CONSTRAINT "GovAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "GovQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovQuote" ADD CONSTRAINT "GovQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovQuote" ADD CONSTRAINT "GovQuote_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "GovProjectStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovReservation" ADD CONSTRAINT "GovReservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectMovement" ADD CONSTRAINT "GovProjectMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectMovement" ADD CONSTRAINT "GovProjectMovement_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "GovProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectMovement" ADD CONSTRAINT "GovProjectMovement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "GovQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectMovement" ADD CONSTRAINT "GovProjectMovement_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

