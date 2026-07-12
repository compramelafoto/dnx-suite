-- Info Spot: configuración de convocatoria de fotógrafos (outbound → CLF).
-- No altera Event CLF ni estados editoriales.
-- Nota: no usa enum EventStatus (ausente en algunos entornos Info Spot).

CREATE TYPE "InfoSpotPhotographerCallProvisioningStatus" AS ENUM (
  'NOT_REQUESTED',
  'PENDING',
  'BLOCKED',
  'PROVISIONING',
  'PROVISIONED',
  'FAILED',
  'CLOSED'
);

CREATE TYPE "InfoSpotPhotographerCallOwnershipStatus" AS ENUM (
  'UNRESOLVED',
  'RESOLVED',
  'BLOCKED'
);

CREATE TYPE "InfoSpotClfCallDesiredStatus" AS ENUM (
  'ACTIVE',
  'CLOSED'
);

CREATE TABLE "InfoSpotPhotographerCall" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
  "joinPolicy" "EventJoinPolicy" NOT NULL DEFAULT 'OPEN',
  "maxPhotographers" INTEGER,
  "photographerTerms" TEXT,
  "operationalDescription" TEXT,
  "clfEventType" "EventType" NOT NULL DEFAULT 'OTHER',
  "desiredClfStatus" "InfoSpotClfCallDesiredStatus" NOT NULL DEFAULT 'ACTIVE',
  "organizerUserId" INTEGER,
  "organizerEmail" TEXT,
  "ownershipStatus" "InfoSpotPhotographerCallOwnershipStatus" NOT NULL DEFAULT 'UNRESOLVED',
  "provisioningStatus" "InfoSpotPhotographerCallProvisioningStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "provisioningError" TEXT,
  "provisioningBlockedReason" TEXT,
  "lastProvisionAttemptAt" TIMESTAMP(3),
  "provisionedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "requestedByUserId" INTEGER,
  "lastModifiedByUserId" INTEGER,
  "clfEventId" INTEGER,
  "publicUrl" TEXT,
  "closeRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotPhotographerCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotPhotographerCall_eventId_key"
  ON "InfoSpotPhotographerCall"("eventId");
CREATE INDEX "InfoSpotPhotographerCall_provisioningStatus_updatedAt_idx"
  ON "InfoSpotPhotographerCall"("provisioningStatus", "updatedAt");
CREATE INDEX "InfoSpotPhotographerCall_clfEventId_idx"
  ON "InfoSpotPhotographerCall"("clfEventId");
CREATE INDEX "InfoSpotPhotographerCall_organizerEmail_idx"
  ON "InfoSpotPhotographerCall"("organizerEmail");
CREATE INDEX "InfoSpotPhotographerCall_enabled_provisioningStatus_idx"
  ON "InfoSpotPhotographerCall"("enabled", "provisioningStatus");

ALTER TABLE "InfoSpotPhotographerCall"
  ADD CONSTRAINT "InfoSpotPhotographerCall_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "InfoSpotPhotographerCall" IS
  'Config operativa de convocatoria; provisioning escribe Event en CLF vía cliente write.';
COMMENT ON COLUMN "InfoSpotPhotographerCall"."provisioningStatus" IS
  'No confundir con InfoSpotEvent.status (editorial).';
