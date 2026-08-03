-- Idempotent residual apply for staging when enums already exist.
-- Safe to re-run. Does not touch production.

DO $$ BEGIN
  CREATE TYPE "ClickatonParticipantCardType" AS ENUM ('WELCOME', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClickatonParticipantCardStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'STALE', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PARTICIPANT_CARD_PNG';

CREATE TABLE IF NOT EXISTS "ClickatonParticipantCard" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonParticipantCard_registrationId_cardType_renderHash_key"
  ON "ClickatonParticipantCard"("registrationId", "cardType", "renderHash");

CREATE INDEX IF NOT EXISTS "ClickatonParticipantCard_registrationId_cardType_status_idx"
  ON "ClickatonParticipantCard"("registrationId", "cardType", "status");

CREATE INDEX IF NOT EXISTS "ClickatonParticipantCard_editionId_status_idx"
  ON "ClickatonParticipantCard"("editionId", "status");

CREATE INDEX IF NOT EXISTS "ClickatonParticipantCard_status_lockExpiresAt_idx"
  ON "ClickatonParticipantCard"("status", "lockExpiresAt");

CREATE INDEX IF NOT EXISTS "ClickatonParticipantCard_renderHash_idx"
  ON "ClickatonParticipantCard"("renderHash");

CREATE INDEX IF NOT EXISTS "ClickatonParticipantCard_assetId_idx"
  ON "ClickatonParticipantCard"("assetId");

DO $$ BEGIN
  ALTER TABLE "ClickatonParticipantCard"
    ADD CONSTRAINT "ClickatonParticipantCard_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonParticipantCard"
    ADD CONSTRAINT "ClickatonParticipantCard_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
