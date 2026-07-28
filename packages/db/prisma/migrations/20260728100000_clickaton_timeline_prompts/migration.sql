-- Etapa 10: timeline versionable + consignas secretas

CREATE TYPE "ClickatonTimelineStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE "ClickatonTimelineEventType" AS ENUM (
  'REGISTRATION_OPEN', 'REGISTRATION_CLOSE', 'ACCREDITATION_OPEN', 'ACCREDITATION_CLOSE',
  'MARATHON_START', 'PROMPT_RELEASE', 'CAPTURE_WINDOW_CLOSE', 'UPLOAD_WINDOW_OPEN',
  'UPLOAD_WINDOW_CLOSE', 'MARATHON_END', 'JUDGING_OPEN', 'JUDGING_CLOSE', 'RESULTS_RELEASE', 'CUSTOM'
);
CREATE TYPE "ClickatonTimelineEventStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'RELEASED', 'CANCELLED', 'SKIPPED');
CREATE TYPE "ClickatonTimelineTriggerMode" AS ENUM ('SCHEDULED', 'MANUAL', 'SCHEDULED_WITH_MANUAL_OVERRIDE');
CREATE TYPE "ClickatonTimelineVisibility" AS ENUM ('PUBLIC_SAFE', 'PARTICIPANT_ONLY', 'ADMIN_ONLY', 'HIDDEN');
CREATE TYPE "ClickatonPromptStatus" AS ENUM ('DRAFT', 'READY', 'LOCKED', 'RELEASED', 'CLOSED', 'CANCELLED');
CREATE TYPE "ClickatonPromptReleaseMode" AS ENUM ('SCHEDULED', 'MANUAL', 'SCHEDULED_WITH_MANUAL_OVERRIDE');

CREATE TABLE IF NOT EXISTS "ClickatonEditionTimeline" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ClickatonTimelineStatus" NOT NULL DEFAULT 'DRAFT',
  "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Cordoba',
  "pauseReason" TEXT,
  "pausedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "activatedByUserId" INTEGER,
  "activatedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonEditionTimeline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEditionTimeline_editionId_version_key" ON "ClickatonEditionTimeline"("editionId", "version");
CREATE INDEX IF NOT EXISTS "ClickatonEditionTimeline_editionId_status_idx" ON "ClickatonEditionTimeline"("editionId", "status");

CREATE TABLE IF NOT EXISTS "ClickatonTimelineEvent" (
  "id" TEXT NOT NULL,
  "timelineId" TEXT NOT NULL,
  "eventType" "ClickatonTimelineEventType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "triggerMode" "ClickatonTimelineTriggerMode" NOT NULL DEFAULT 'SCHEDULED',
  "visibilityPolicy" "ClickatonTimelineVisibility" NOT NULL DEFAULT 'PUBLIC_SAFE',
  "status" "ClickatonTimelineEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "manuallyReleasedAt" TIMESTAMP(3),
  "manuallyReleasedByUserId" INTEGER,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonTimelineEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClickatonTimelineEvent_timelineId_sequence_idx" ON "ClickatonTimelineEvent"("timelineId", "sequence");
CREATE INDEX IF NOT EXISTS "ClickatonTimelineEvent_timelineId_eventType_idx" ON "ClickatonTimelineEvent"("timelineId", "eventType");
CREATE INDEX IF NOT EXISTS "ClickatonTimelineEvent_timelineId_startsAt_idx" ON "ClickatonTimelineEvent"("timelineId", "startsAt");

CREATE TABLE IF NOT EXISTS "ClickatonPrompt" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "timelineEventId" TEXT,
  "sequence" INTEGER NOT NULL,
  "internalName" TEXT NOT NULL,
  "title" TEXT,
  "instructions" TEXT,
  "shortDescription" TEXT,
  "imageAssetId" TEXT,
  "videoAssetId" TEXT,
  "audioAssetId" TEXT,
  "categoryId" TEXT,
  "captureStartsAt" TIMESTAMP(3),
  "captureEndsAt" TIMESTAMP(3),
  "uploadEndsAt" TIMESTAMP(3),
  "releaseMode" "ClickatonPromptReleaseMode" NOT NULL DEFAULT 'SCHEDULED',
  "status" "ClickatonPromptStatus" NOT NULL DEFAULT 'DRAFT',
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" INTEGER,
  "releasedAt" TIMESTAMP(3),
  "releasedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonPrompt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonPrompt_editionId_sequence_key" ON "ClickatonPrompt"("editionId", "sequence");
CREATE INDEX IF NOT EXISTS "ClickatonPrompt_editionId_status_idx" ON "ClickatonPrompt"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonPrompt_timelineEventId_idx" ON "ClickatonPrompt"("timelineEventId");

CREATE TABLE IF NOT EXISTS "ClickatonTimelineAudit" (
  "id" TEXT NOT NULL,
  "timelineId" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonTimelineAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClickatonTimelineAudit_timelineId_createdAt_idx" ON "ClickatonTimelineAudit"("timelineId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonTimelineAudit_action_idx" ON "ClickatonTimelineAudit"("action");

CREATE TABLE IF NOT EXISTS "ClickatonEditionCapabilityGrant" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "capability" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonEditionCapabilityGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEditionCapabilityGrant_editionId_userId_capability_key"
  ON "ClickatonEditionCapabilityGrant"("editionId", "userId", "capability");
CREATE INDEX IF NOT EXISTS "ClickatonEditionCapabilityGrant_userId_capability_idx"
  ON "ClickatonEditionCapabilityGrant"("userId", "capability");

DO $$ BEGIN
  ALTER TABLE "ClickatonEditionTimeline" ADD CONSTRAINT "ClickatonEditionTimeline_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonEditionTimeline" ADD CONSTRAINT "ClickatonEditionTimeline_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonEditionTimeline" ADD CONSTRAINT "ClickatonEditionTimeline_activatedByUserId_fkey"
    FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonTimelineEvent" ADD CONSTRAINT "ClickatonTimelineEvent_timelineId_fkey"
    FOREIGN KEY ("timelineId") REFERENCES "ClickatonEditionTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonTimelineEvent" ADD CONSTRAINT "ClickatonTimelineEvent_manuallyReleasedByUserId_fkey"
    FOREIGN KEY ("manuallyReleasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_timelineEventId_fkey"
    FOREIGN KEY ("timelineEventId") REFERENCES "ClickatonTimelineEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_releasedByUserId_fkey"
    FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonTimelineAudit" ADD CONSTRAINT "ClickatonTimelineAudit_timelineId_fkey"
    FOREIGN KEY ("timelineId") REFERENCES "ClickatonEditionTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonTimelineAudit" ADD CONSTRAINT "ClickatonTimelineAudit_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonEditionCapabilityGrant" ADD CONSTRAINT "ClickatonEditionCapabilityGrant_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonEditionCapabilityGrant" ADD CONSTRAINT "ClickatonEditionCapabilityGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
