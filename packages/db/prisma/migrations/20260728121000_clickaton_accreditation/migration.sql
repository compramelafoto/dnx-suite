-- Etapa 12: acreditación presencial, dispositivos, offline sync, campos check-in

-- CheckInSource extensions
ALTER TYPE "ClickatonCheckInSource" ADD VALUE IF NOT EXISTS 'PARTICIPANT_NUMBER';
ALTER TYPE "ClickatonCheckInSource" ADD VALUE IF NOT EXISTS 'DOCUMENT_SEARCH';
ALTER TYPE "ClickatonCheckInSource" ADD VALUE IF NOT EXISTS 'OFFLINE_SYNC';

CREATE TYPE "ClickatonAccreditationIdentityMode" AS ENUM ('NOT_REQUIRED', 'VISUAL', 'DOCUMENT', 'CONTROL_QUESTION', 'MANUAL_REVIEW');
CREATE TYPE "ClickatonAccreditationIdentityStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'MISMATCH', 'EXCEPTION_GRANTED');
CREATE TYPE "ClickatonAccreditationGeofenceMode" AS ENUM ('OFF', 'OPTIONAL', 'REQUIRED_FOR_DEVICE', 'MANUAL_REVIEW');
CREATE TYPE "ClickatonAccreditationDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED', 'LOST', 'DISABLED');
CREATE TYPE "ClickatonOfflineSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'REJECTED');

CREATE TABLE IF NOT EXISTS "ClickatonEditionAccreditationConfig" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "accreditationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "identityMode" "ClickatonAccreditationIdentityMode" NOT NULL DEFAULT 'VISUAL',
  "geofenceMode" "ClickatonAccreditationGeofenceMode" NOT NULL DEFAULT 'OFF',
  "geofenceCenterLat" DOUBLE PRECISION,
  "geofenceCenterLng" DOUBLE PRECISION,
  "geofenceRadiusMeters" INTEGER,
  "geofenceToleranceMeters" INTEGER DEFAULT 50,
  "allowOfflineEvents" BOOLEAN NOT NULL DEFAULT true,
  "shortCodeEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonEditionAccreditationConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEditionAccreditationConfig_editionId_key" ON "ClickatonEditionAccreditationConfig"("editionId");
ALTER TABLE "ClickatonEditionAccreditationConfig"
  ADD CONSTRAINT "ClickatonEditionAccreditationConfig_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonAccreditationDevice" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceTokenHash" TEXT NOT NULL,
  "status" "ClickatonAccreditationDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedUserId" INTEGER,
  "lastSeenAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonAccreditationDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAccreditationDevice_deviceTokenHash_key" ON "ClickatonAccreditationDevice"("deviceTokenHash");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationDevice_editionId_status_idx" ON "ClickatonAccreditationDevice"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationDevice_assignedUserId_idx" ON "ClickatonAccreditationDevice"("assignedUserId");
ALTER TABLE "ClickatonAccreditationDevice"
  ADD CONSTRAINT "ClickatonAccreditationDevice_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonAccreditationAudit" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT,
  "checkInId" TEXT,
  "action" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "deviceId" TEXT,
  "previousValue" JSONB,
  "nextValue" JSONB,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonAccreditationAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationAudit_editionId_createdAt_idx" ON "ClickatonAccreditationAudit"("editionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationAudit_registrationId_createdAt_idx" ON "ClickatonAccreditationAudit"("registrationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationAudit_action_idx" ON "ClickatonAccreditationAudit"("action");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationAudit_checkInId_idx" ON "ClickatonAccreditationAudit"("checkInId");
ALTER TABLE "ClickatonAccreditationAudit"
  ADD CONSTRAINT "ClickatonAccreditationAudit_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonAccreditationOfflineEvent" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "deviceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "qrTokenHashHint" TEXT,
  "registrationIdHint" TEXT,
  "action" TEXT NOT NULL,
  "clientOccurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "syncStatus" "ClickatonOfflineSyncStatus" NOT NULL DEFAULT 'PENDING',
  "syncedAt" TIMESTAMP(3),
  "conflictReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonAccreditationOfflineEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAccreditationOfflineEvent_idempotencyKey_key" ON "ClickatonAccreditationOfflineEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationOfflineEvent_editionId_syncStatus_idx" ON "ClickatonAccreditationOfflineEvent"("editionId", "syncStatus");
CREATE INDEX IF NOT EXISTS "ClickatonAccreditationOfflineEvent_deviceId_syncStatus_idx" ON "ClickatonAccreditationOfflineEvent"("deviceId", "syncStatus");
ALTER TABLE "ClickatonAccreditationOfflineEvent"
  ADD CONSTRAINT "ClickatonAccreditationOfflineEvent_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonAccreditationOfflineEvent"
  ADD CONSTRAINT "ClickatonAccreditationOfflineEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "ClickatonAccreditationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "identityStatus" "ClickatonAccreditationIdentityStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "identityMethod" "ClickatonAccreditationIdentityMode";
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "identityNotes" TEXT;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "exceptionReason" TEXT;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "timelineVersionSnapshot" INTEGER;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "onlineMode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "checkInLocationLat" DOUBLE PRECISION;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "checkInLocationLng" DOUBLE PRECISION;
ALTER TABLE "ClickatonCheckIn" ADD COLUMN IF NOT EXISTS "notes" TEXT;
CREATE INDEX IF NOT EXISTS "ClickatonCheckIn_deviceId_idx" ON "ClickatonCheckIn"("deviceId");
ALTER TABLE "ClickatonCheckIn"
  ADD CONSTRAINT "ClickatonCheckIn_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "ClickatonAccreditationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
