-- CreateEnum
CREATE TYPE "ClickatonParticipantCardType" AS ENUM ('WELCOME', 'MEMBER');

-- CreateEnum
CREATE TYPE "ClickatonParticipantCardStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'STALE', 'DELETED');

-- AlterEnum
ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PARTICIPANT_CARD_PNG';

-- CreateTable
CREATE TABLE "ClickatonParticipantCard" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "cardType" "ClickatonParticipantCardType" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "renderHash" TEXT NOT NULL,
    "status" "ClickatonParticipantCardStatus" NOT NULL DEFAULT 'GENERATING',
    "assetId" TEXT,
    "storageKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "byteSize" INTEGER,
    "contentHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "generatedByUserId" INTEGER,
    "sourceUpdatedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonParticipantCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonParticipantCard_registrationId_cardType_renderHash_key" ON "ClickatonParticipantCard"("registrationId", "cardType", "renderHash");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCard_registrationId_cardType_status_idx" ON "ClickatonParticipantCard"("registrationId", "cardType", "status");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCard_editionId_status_idx" ON "ClickatonParticipantCard"("editionId", "status");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCard_status_lockExpiresAt_idx" ON "ClickatonParticipantCard"("status", "lockExpiresAt");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCard_renderHash_idx" ON "ClickatonParticipantCard"("renderHash");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCard_assetId_idx" ON "ClickatonParticipantCard"("assetId");

-- AddForeignKey
ALTER TABLE "ClickatonParticipantCard" ADD CONSTRAINT "ClickatonParticipantCard_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonParticipantCard" ADD CONSTRAINT "ClickatonParticipantCard_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
