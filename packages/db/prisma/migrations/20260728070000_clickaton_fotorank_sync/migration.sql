-- Etapa 7: sync mínima Clickatón → FotoRank postpago + roster FR + prep social.

CREATE TYPE "ClickatonFotoRankValidationStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING_VALIDATION', 'VALID', 'INVALID', 'DISABLED');
CREATE TYPE "ClickatonFotoRankSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'SYNCED', 'RETRY_PENDING', 'FAILED', 'MANUAL_REVIEW', 'DISABLED');
CREATE TYPE "ClickatonFotoRankSyncMode" AS ENUM ('POST_PAID', 'DISABLED');
CREATE TYPE "ClickatonProfilePhotoSource" AS ENUM ('USER_UPLOAD', 'INSTAGRAM_IMPORT', 'ADMIN_UPLOAD');
CREATE TYPE "ClickatonIntegrationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD');

ALTER TABLE "ClickatonEdition"
  ADD COLUMN "fotoRankSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fotoRankSyncMode" "ClickatonFotoRankSyncMode" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "fotoRankValidationStatus" "ClickatonFotoRankValidationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "fotoRankLastValidatedAt" TIMESTAMP(3),
  ADD COLUMN "fotoRankValidationError" TEXT;

CREATE INDEX "ClickatonEdition_fotoRankSyncEnabled_idx" ON "ClickatonEdition"("fotoRankSyncEnabled");

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN "instagramHandle" TEXT,
  ADD COLUMN "instagramHandleNormalized" TEXT,
  ADD COLUMN "profilePhotoAssetId" TEXT,
  ADD COLUMN "profilePhotoSource" "ClickatonProfilePhotoSource",
  ADD COLUMN "profilePhotoStatus" TEXT,
  ADD COLUMN "imageUsageConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "socialPublicationConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consentAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "consentVersion" TEXT,
  ADD COLUMN "fotoRankParticipantId" TEXT,
  ADD COLUMN "fotoRankSyncStatus" "ClickatonFotoRankSyncStatus",
  ADD COLUMN "fotoRankSyncedAt" TIMESTAMP(3);

CREATE INDEX "ClickatonRegistration_fotoRankSyncStatus_idx" ON "ClickatonRegistration"("fotoRankSyncStatus");
CREATE INDEX "ClickatonRegistration_instagramHandleNormalized_idx" ON "ClickatonRegistration"("instagramHandleNormalized");

CREATE TABLE "FotorankContestParticipant" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "clickatonParticipantNumber" TEXT,
  "sequenceNumber" INTEGER,
  "sourcePlatform" TEXT NOT NULL DEFAULT 'CLICKATON',
  "externalRegistrationId" TEXT,
  "externalEditionId" TEXT,
  "externalUserId" TEXT,
  "firstNameSnapshot" TEXT,
  "lastNameSnapshot" TEXT,
  "emailSnapshot" TEXT,
  "phoneSnapshot" TEXT,
  "citySnapshot" TEXT,
  "provinceSnapshot" TEXT,
  "countrySnapshot" TEXT,
  "instagramHandle" TEXT,
  "profilePhotoAssetId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FotorankContestParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankContestParticipant_contestId_userId_key" ON "FotorankContestParticipant"("contestId", "userId");
CREATE UNIQUE INDEX "FotorankContestParticipant_contestId_externalRegistrationId_key" ON "FotorankContestParticipant"("contestId", "externalRegistrationId");
CREATE INDEX "FotorankContestParticipant_contestId_enabled_idx" ON "FotorankContestParticipant"("contestId", "enabled");
CREATE INDEX "FotorankContestParticipant_externalRegistrationId_idx" ON "FotorankContestParticipant"("externalRegistrationId");
CREATE INDEX "FotorankContestParticipant_sourcePlatform_idx" ON "FotorankContestParticipant"("sourcePlatform");
CREATE INDEX "FotorankContestParticipant_userId_idx" ON "FotorankContestParticipant"("userId");

ALTER TABLE "FotorankContestParticipant" ADD CONSTRAINT "FotorankContestParticipant_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FotorankContestParticipant" ADD CONSTRAINT "FotorankContestParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClickatonFotoRankSync" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "fotoRankContestId" TEXT NOT NULL,
  "fotoRankParticipantId" TEXT,
  "status" "ClickatonFotoRankSyncStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "syncVersion" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ClickatonFotoRankSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonFotoRankSync_idempotencyKey_key" ON "ClickatonFotoRankSync"("idempotencyKey");
CREATE UNIQUE INDEX "ClickatonFotoRankSync_registrationId_fotoRankContestId_key" ON "ClickatonFotoRankSync"("registrationId", "fotoRankContestId");
CREATE INDEX "ClickatonFotoRankSync_editionId_status_idx" ON "ClickatonFotoRankSync"("editionId", "status");
CREATE INDEX "ClickatonFotoRankSync_status_nextRetryAt_idx" ON "ClickatonFotoRankSync"("status", "nextRetryAt");
CREATE INDEX "ClickatonFotoRankSync_userId_idx" ON "ClickatonFotoRankSync"("userId");
CREATE INDEX "ClickatonFotoRankSync_fotoRankParticipantId_idx" ON "ClickatonFotoRankSync"("fotoRankParticipantId");

ALTER TABLE "ClickatonFotoRankSync" ADD CONSTRAINT "ClickatonFotoRankSync_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonFotoRankSync" ADD CONSTRAINT "ClickatonFotoRankSync_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonFotoRankSync" ADD CONSTRAINT "ClickatonFotoRankSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClickatonIntegrationOutboxEvent" (
  "id" TEXT NOT NULL,
  "editionId" TEXT,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ClickatonIntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonIntegrationOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonIntegrationOutboxEvent_idempotencyKey_key" ON "ClickatonIntegrationOutboxEvent"("idempotencyKey");
CREATE INDEX "ClickatonIntegrationOutboxEvent_status_availableAt_idx" ON "ClickatonIntegrationOutboxEvent"("status", "availableAt");
CREATE INDEX "ClickatonIntegrationOutboxEvent_aggregateType_aggregateId_idx" ON "ClickatonIntegrationOutboxEvent"("aggregateType", "aggregateId");
CREATE INDEX "ClickatonIntegrationOutboxEvent_eventType_status_idx" ON "ClickatonIntegrationOutboxEvent"("eventType", "status");

ALTER TABLE "ClickatonIntegrationOutboxEvent" ADD CONSTRAINT "ClickatonIntegrationOutboxEvent_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
