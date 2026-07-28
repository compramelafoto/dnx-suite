-- Etapa 9: DNX Social Publisher

CREATE TYPE "DnxSocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'THREADS', 'LINKEDIN', 'X', 'TIKTOK');
CREATE TYPE "DnxSocialAccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING', 'DISABLED');
CREATE TYPE "DnxSocialPublishStatus" AS ENUM (
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHING',
  'PUBLISHED', 'FAILED', 'CANCELLED', 'REJECTED'
);
CREATE TYPE "DnxSocialPublishPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE IF NOT EXISTS "DnxSocialAccount" (
  "id" TEXT NOT NULL,
  "platform" "DnxSocialPlatform" NOT NULL,
  "ownerUserId" INTEGER NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "businessId" TEXT,
  "username" TEXT,
  "displayName" TEXT,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "DnxSocialAccountStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "lastValidatedAt" TIMESTAMP(3),
  "tokenCiphertext" TEXT,
  "tokenNonce" TEXT,
  "tokenAuthTag" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxSocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxSocialAccount_platform_externalAccountId_key"
  ON "DnxSocialAccount"("platform", "externalAccountId");
CREATE INDEX IF NOT EXISTS "DnxSocialAccount_ownerUserId_platform_idx"
  ON "DnxSocialAccount"("ownerUserId", "platform");
CREATE INDEX IF NOT EXISTS "DnxSocialAccount_status_idx" ON "DnxSocialAccount"("status");
CREATE INDEX IF NOT EXISTS "DnxSocialAccount_username_idx" ON "DnxSocialAccount"("username");

CREATE TABLE IF NOT EXISTS "DnxSocialAccountGrant" (
  "id" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "granteeUserId" INTEGER,
  "application" TEXT NOT NULL,
  "canPublish" BOOLEAN NOT NULL DEFAULT true,
  "canApprove" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxSocialAccountGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DnxSocialAccountGrant_socialAccountId_idx" ON "DnxSocialAccountGrant"("socialAccountId");
CREATE INDEX IF NOT EXISTS "DnxSocialAccountGrant_application_idx" ON "DnxSocialAccountGrant"("application");
CREATE INDEX IF NOT EXISTS "DnxSocialAccountGrant_granteeUserId_idx" ON "DnxSocialAccountGrant"("granteeUserId");

CREATE TABLE IF NOT EXISTS "DnxSocialPublishRequest" (
  "id" TEXT NOT NULL,
  "application" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "templateRef" TEXT,
  "caption" TEXT NOT NULL,
  "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "assets" JSONB NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "platform" "DnxSocialPlatform" NOT NULL,
  "status" "DnxSocialPublishStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "priority" "DnxSocialPublishPriority" NOT NULL DEFAULT 'NORMAL',
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "scheduleAt" TIMESTAMP(3),
  "timezone" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" INTEGER,
  "rejectedAt" TIMESTAMP(3),
  "rejectedByUserId" INTEGER,
  "rejectionReason" TEXT,
  "publishedAt" TIMESTAMP(3),
  "externalMediaId" TEXT,
  "externalPostId" TEXT,
  "permalink" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxSocialPublishRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxSocialPublishRequest_idempotencyKey_key"
  ON "DnxSocialPublishRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_application_status_idx"
  ON "DnxSocialPublishRequest"("application", "status");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_entityType_entityId_idx"
  ON "DnxSocialPublishRequest"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_socialAccountId_status_idx"
  ON "DnxSocialPublishRequest"("socialAccountId", "status");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_status_scheduleAt_idx"
  ON "DnxSocialPublishRequest"("status", "scheduleAt");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_status_nextRetryAt_idx"
  ON "DnxSocialPublishRequest"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishRequest_platform_status_idx"
  ON "DnxSocialPublishRequest"("platform", "status");

CREATE TABLE IF NOT EXISTS "DnxSocialPublishAttempt" (
  "id" TEXT NOT NULL,
  "publishRequestId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "durationMs" INTEGER,
  "providerRaw" JSONB,
  CONSTRAINT "DnxSocialPublishAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DnxSocialPublishAttempt_publishRequestId_attemptNumber_idx"
  ON "DnxSocialPublishAttempt"("publishRequestId", "attemptNumber");

CREATE TABLE IF NOT EXISTS "DnxSocialPublishLog" (
  "id" TEXT NOT NULL,
  "publishRequestId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxSocialPublishLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DnxSocialPublishLog_publishRequestId_createdAt_idx"
  ON "DnxSocialPublishLog"("publishRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "DnxSocialPublishLog_action_idx" ON "DnxSocialPublishLog"("action");

DO $$ BEGIN
  ALTER TABLE "DnxSocialAccount" ADD CONSTRAINT "DnxSocialAccount_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialAccountGrant" ADD CONSTRAINT "DnxSocialAccountGrant_socialAccountId_fkey"
    FOREIGN KEY ("socialAccountId") REFERENCES "DnxSocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialPublishRequest" ADD CONSTRAINT "DnxSocialPublishRequest_socialAccountId_fkey"
    FOREIGN KEY ("socialAccountId") REFERENCES "DnxSocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialPublishRequest" ADD CONSTRAINT "DnxSocialPublishRequest_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialPublishRequest" ADD CONSTRAINT "DnxSocialPublishRequest_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialPublishAttempt" ADD CONSTRAINT "DnxSocialPublishAttempt_publishRequestId_fkey"
    FOREIGN KEY ("publishRequestId") REFERENCES "DnxSocialPublishRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DnxSocialPublishLog" ADD CONSTRAINT "DnxSocialPublishLog_publishRequestId_fkey"
    FOREIGN KEY ("publishRequestId") REFERENCES "DnxSocialPublishRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
