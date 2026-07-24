-- Etapa 18+19: DNX Notifications Engine (schema completo operativo).
-- Aditivo / IF NOT EXISTS. NO usar migrate deploy completo en hosts ambiguos.
-- Aplicar con scripts/apply-dnx-notifications-migration.mts + DNX_NOTIFICATIONS_ALLOW_MIGRATE=1.

ALTER TABLE "InfoSpotUserRole"
  ADD COLUMN IF NOT EXISTS "canNotifyClfPhotographerCall" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InfoSpotUserRole"
SET "canNotifyClfPhotographerCall" = true
WHERE "role" = 'INFOSPOT_DIRECTOR';

CREATE INDEX IF NOT EXISTS "InfoSpotUserRole_canNotifyClfPhotographerCall_status_idx"
  ON "InfoSpotUserRole"("canNotifyClfPhotographerCall", "status");

DO $$ BEGIN
  CREATE TYPE "DnxNotificationCampaignStatus" AS ENUM (
    'DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DnxNotificationDeliveryStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD_LETTER', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DnxNotificationChannel" AS ENUM (
    'IN_APP', 'EMAIL', 'WEB_PUSH', 'TELEGRAM', 'WHATSAPP', 'SMS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DnxNotificationEventLog" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceApp" TEXT NOT NULL,
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxNotificationEventLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationEventLog_idempotencyKey_key"
  ON "DnxNotificationEventLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DnxNotificationEventLog_eventType_createdAt_idx"
  ON "DnxNotificationEventLog"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationEventLog_sourceEntityType_sourceEntityId_idx"
  ON "DnxNotificationEventLog"("sourceEntityType", "sourceEntityId");

CREATE TABLE IF NOT EXISTS "DnxNotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "nearbyPhotographerCalls" BOOLEAN NOT NULL DEFAULT true,
  "cityEvents" BOOLEAN NOT NULL DEFAULT false,
  "callReminders" BOOLEAN NOT NULL DEFAULT false,
  "courses" BOOLEAN NOT NULL DEFAULT false,
  "contests" BOOLEAN NOT NULL DEFAULT false,
  "channelInApp" BOOLEAN NOT NULL DEFAULT true,
  "channelEmail" BOOLEAN NOT NULL DEFAULT false,
  "channelWebPush" BOOLEAN NOT NULL DEFAULT false,
  "preferredScopeMode" TEXT,
  "preferredRadiusKm" INTEGER,
  "useProfileLocation" BOOLEAN NOT NULL DEFAULT true,
  "manualCity" TEXT,
  "frequency" TEXT NOT NULL DEFAULT 'IMMEDIATE',
  "externalMarketingConsentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxNotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationPreference_userId_key"
  ON "DnxNotificationPreference"("userId");

CREATE TABLE IF NOT EXISTS "DnxNotificationCampaign" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceApp" TEXT NOT NULL,
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "clfEventId" INTEGER,
  "status" "DnxNotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "campaignCycle" TEXT NOT NULL DEFAULT 'default',
  "campaignDedupeKey" TEXT NOT NULL,
  "scopeMode" TEXT NOT NULL,
  "radiusKm" INTEGER,
  "centerCity" TEXT,
  "centerProvince" TEXT,
  "centerLatitude" DOUBLE PRECISION,
  "centerLongitude" DOUBLE PRECISION,
  "channels" "DnxNotificationChannel"[],
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "ctaUrl" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL DEFAULT 'Ver convocatoria',
  "createdByUserId" INTEGER NOT NULL,
  "confirmedByUserId" INTEGER,
  "confirmedAt" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" INTEGER,
  "cancelReason" TEXT,
  "retriedAt" TIMESTAMP(3),
  "retriedByUserId" INTEGER,
  "audienceCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "excludedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "readCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "applicationCount" INTEGER NOT NULL DEFAULT 0,
  "filtersJson" JSONB,
  "exclusionSummaryJson" JSONB,
  "confirmationSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxNotificationCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationCampaign_campaignDedupeKey_key"
  ON "DnxNotificationCampaign"("campaignDedupeKey");
CREATE INDEX IF NOT EXISTS "DnxNotificationCampaign_sourceEntityType_sourceEntityId_createdAt_idx"
  ON "DnxNotificationCampaign"("sourceEntityType", "sourceEntityId", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationCampaign_eventType_createdAt_idx"
  ON "DnxNotificationCampaign"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationCampaign_status_scheduledAt_idx"
  ON "DnxNotificationCampaign"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationCampaign_createdByUserId_createdAt_idx"
  ON "DnxNotificationCampaign"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationCampaign_clfEventId_idx"
  ON "DnxNotificationCampaign"("clfEventId");

CREATE TABLE IF NOT EXISTS "DnxNotificationDelivery" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "channel" "DnxNotificationChannel" NOT NULL,
  "status" "DnxNotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "errorCode" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "ctaUrl" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL DEFAULT 'Ver convocatoria',
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lockExpiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "distanceKm" DOUBLE PRECISION,
  "citySnapshot" TEXT,
  "dashboardNotificationId" INTEGER,
  "emailQueueId" INTEGER,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxNotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationDelivery_dedupeKey_key"
  ON "DnxNotificationDelivery"("dedupeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationDelivery_publicToken_key"
  ON "DnxNotificationDelivery"("publicToken");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_campaignId_status_idx"
  ON "DnxNotificationDelivery"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_userId_createdAt_idx"
  ON "DnxNotificationDelivery"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_status_scheduledAt_idx"
  ON "DnxNotificationDelivery"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_status_lockExpiresAt_idx"
  ON "DnxNotificationDelivery"("status", "lockExpiresAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_dashboardNotificationId_idx"
  ON "DnxNotificationDelivery"("dashboardNotificationId");
CREATE INDEX IF NOT EXISTS "DnxNotificationDelivery_emailQueueId_idx"
  ON "DnxNotificationDelivery"("emailQueueId");

CREATE TABLE IF NOT EXISTS "DnxNotificationAttribution" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "clfEventId" INTEGER,
  "eventMemberId" INTEGER,
  "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxNotificationAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationAttribution_deliveryId_key"
  ON "DnxNotificationAttribution"("deliveryId");
CREATE UNIQUE INDEX IF NOT EXISTS "DnxNotificationAttribution_campaignId_userId_clfEventId_key"
  ON "DnxNotificationAttribution"("campaignId", "userId", "clfEventId");
CREATE INDEX IF NOT EXISTS "DnxNotificationAttribution_userId_attributedAt_idx"
  ON "DnxNotificationAttribution"("userId", "attributedAt");
CREATE INDEX IF NOT EXISTS "DnxNotificationAttribution_clfEventId_idx"
  ON "DnxNotificationAttribution"("clfEventId");

DO $$ BEGIN
  ALTER TABLE "DnxNotificationPreference"
    ADD CONSTRAINT "DnxNotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationCampaign"
    ADD CONSTRAINT "DnxNotificationCampaign_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationCampaign"
    ADD CONSTRAINT "DnxNotificationCampaign_confirmedByUserId_fkey"
    FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationCampaign"
    ADD CONSTRAINT "DnxNotificationCampaign_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationCampaign"
    ADD CONSTRAINT "DnxNotificationCampaign_retriedByUserId_fkey"
    FOREIGN KEY ("retriedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationDelivery"
    ADD CONSTRAINT "DnxNotificationDelivery_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "DnxNotificationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationDelivery"
    ADD CONSTRAINT "DnxNotificationDelivery_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationAttribution"
    ADD CONSTRAINT "DnxNotificationAttribution_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "DnxNotificationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationAttribution"
    ADD CONSTRAINT "DnxNotificationAttribution_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "DnxNotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxNotificationAttribution"
    ADD CONSTRAINT "DnxNotificationAttribution_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
