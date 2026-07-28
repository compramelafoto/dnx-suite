-- Etapa 8: perfil social + placas de bienvenida (DnxMediaAsset / DnxWelcomeCard)

CREATE TYPE "ClickatonProfilePhotoStatus" AS ENUM ('PENDING', 'READY', 'REJECTED');
CREATE TYPE "DnxMediaAssetKind" AS ENUM (
  'PROFILE_ORIGINAL',
  'PROFILE_THUMBNAIL',
  'PROFILE_SQUARE',
  'PROFILE_STORY_CROP',
  'WELCOME_CARD_PNG',
  'WELCOME_CARD_WEBP',
  'LOGO',
  'OTHER'
);
CREATE TYPE "DnxWelcomeCardStatus" AS ENUM ('PENDING', 'GENERATED', 'APPROVED', 'PUBLISHED', 'FAILED');
CREATE TYPE "DnxWelcomePublicationStatus" AS ENUM (
  'NOT_SCHEDULED',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED'
);

ALTER TABLE "FotorankContestParticipant"
  ADD COLUMN IF NOT EXISTS "welcomeCardAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "welcomeCardStatus" TEXT;

CREATE INDEX IF NOT EXISTS "FotorankContestParticipant_welcomeCardStatus_idx"
  ON "FotorankContestParticipant"("welcomeCardStatus");

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "profilePhotoCropX" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "profilePhotoCropY" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "profilePhotoZoom" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "profilePhotoRotation" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "profilePhotoBoundingBox" JSONB,
  ADD COLUMN IF NOT EXISTS "welcomeCardId" TEXT,
  ADD COLUMN IF NOT EXISTS "welcomeCardStatus" "DnxWelcomeCardStatus",
  ADD COLUMN IF NOT EXISTS "welcomeCardAssetId" TEXT,
  ADD COLUMN IF NOT EXISTS "welcomePublicationStatus" "DnxWelcomePublicationStatus";

-- profilePhotoStatus was String → enum (safe: abort on unknown values; never silent remap)
DO $$
DECLARE
  bad_count BIGINT;
  bad_sample TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ClickatonRegistration'
      AND column_name = 'profilePhotoStatus'
      AND udt_name = 'ClickatonProfilePhotoStatus'
  ) THEN
    RAISE NOTICE 'profilePhotoStatus already enum — skip cast';
    RETURN;
  END IF;

  SELECT COUNT(*), string_agg(DISTINCT left(COALESCE("profilePhotoStatus", '<NULL>'), 40), ', ')
  INTO bad_count, bad_sample
  FROM "ClickatonRegistration"
  WHERE "profilePhotoStatus" IS NOT NULL
    AND upper("profilePhotoStatus") NOT IN ('PENDING', 'READY', 'REJECTED');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'welcome_cards preflight FAILED: % ClickatonRegistration.profilePhotoStatus value(s) incompatible (sample: %). Fix or null them before migrate.',
      bad_count, bad_sample;
  END IF;

  ALTER TABLE "ClickatonRegistration"
    ALTER COLUMN "profilePhotoStatus" TYPE "ClickatonProfilePhotoStatus"
    USING (
      CASE
        WHEN "profilePhotoStatus" IS NULL THEN NULL
        ELSE upper("profilePhotoStatus")::"ClickatonProfilePhotoStatus"
      END
    );
END $$;

CREATE INDEX IF NOT EXISTS "ClickatonRegistration_welcomeCardStatus_idx"
  ON "ClickatonRegistration"("welcomeCardStatus");
CREATE INDEX IF NOT EXISTS "ClickatonRegistration_welcomePublicationStatus_idx"
  ON "ClickatonRegistration"("welcomePublicationStatus");

CREATE TABLE IF NOT EXISTS "DnxMediaAsset" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "editionId" TEXT,
  "registrationId" TEXT,
  "kind" "DnxMediaAssetKind" NOT NULL,
  "storageBackend" TEXT NOT NULL DEFAULT 'R2',
  "storageKey" TEXT NOT NULL,
  "publicUrl" TEXT,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "bytes" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxMediaAsset_storageBackend_storageKey_key"
  ON "DnxMediaAsset"("storageBackend", "storageKey");
CREATE INDEX IF NOT EXISTS "DnxMediaAsset_platform_ownerType_ownerId_idx"
  ON "DnxMediaAsset"("platform", "ownerType", "ownerId");
CREATE INDEX IF NOT EXISTS "DnxMediaAsset_registrationId_kind_idx"
  ON "DnxMediaAsset"("registrationId", "kind");
CREATE INDEX IF NOT EXISTS "DnxMediaAsset_editionId_idx" ON "DnxMediaAsset"("editionId");
CREATE INDEX IF NOT EXISTS "DnxMediaAsset_contentHash_idx" ON "DnxMediaAsset"("contentHash");

CREATE TABLE IF NOT EXISTS "DnxWelcomeCard" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'CLICKATON',
  "ownerType" TEXT NOT NULL DEFAULT 'REGISTRATION',
  "ownerId" TEXT NOT NULL,
  "editionId" TEXT,
  "registrationId" TEXT,
  "templateId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "rendererVersion" TEXT NOT NULL,
  "status" "DnxWelcomeCardStatus" NOT NULL DEFAULT 'PENDING',
  "pngAssetId" TEXT,
  "webpAssetId" TEXT,
  "variablesSnapshot" JSONB,
  "cropSnapshot" JSONB,
  "contentHash" TEXT,
  "inputHash" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "generatedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "publicationStatus" "DnxWelcomePublicationStatus" NOT NULL DEFAULT 'NOT_SCHEDULED',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "metaMediaId" TEXT,
  "instagramPostId" TEXT,
  "publicationError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxWelcomeCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxWelcomeCard_platform_ownerType_ownerId_templateId_key"
  ON "DnxWelcomeCard"("platform", "ownerType", "ownerId", "templateId");
CREATE INDEX IF NOT EXISTS "DnxWelcomeCard_editionId_status_idx" ON "DnxWelcomeCard"("editionId", "status");
CREATE INDEX IF NOT EXISTS "DnxWelcomeCard_registrationId_idx" ON "DnxWelcomeCard"("registrationId");
CREATE INDEX IF NOT EXISTS "DnxWelcomeCard_status_nextRetryAt_idx" ON "DnxWelcomeCard"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "DnxWelcomeCard_publicationStatus_idx" ON "DnxWelcomeCard"("publicationStatus");
CREATE INDEX IF NOT EXISTS "DnxWelcomeCard_inputHash_idx" ON "DnxWelcomeCard"("inputHash");

DO $$ BEGIN
  ALTER TABLE "DnxMediaAsset" ADD CONSTRAINT "DnxMediaAsset_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxMediaAsset" ADD CONSTRAINT "DnxMediaAsset_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxWelcomeCard" ADD CONSTRAINT "DnxWelcomeCard_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxWelcomeCard" ADD CONSTRAINT "DnxWelcomeCard_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
