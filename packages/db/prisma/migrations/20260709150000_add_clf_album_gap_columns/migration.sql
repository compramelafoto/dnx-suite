-- CLF Album gap columns (monorepo schema vs applied migrations)
-- Staging Neon (ep-round-fog) is missing Album columns that Prisma Client expects
-- after legacy merges (retention cleanup pipeline + school/pack/face-bulk fields).
-- Missing `Album.cleanupStatus` causes runtime failure on GET /api/public/albums
-- (Prisma loads full model rows and validates all scalar columns).
--
-- Forward-only, additive, idempotent. Preserves existing rows with safe defaults.
-- Do NOT apply to production yet.
--
-- Scope: Album scalars + required enums only.
-- Intentionally skips FK to AcademicYear (table absent on staging); academicYearId
-- is added as nullable Int without constraint so Prisma Client can select it.

-- ---------------------------------------------------------------------------
-- Enums (create if missing)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "AlbumCleanupStatus" AS ENUM (
    'NONE',
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'COMPLETED_WITH_REFERENCES',
    'BLOCKED_PRINT',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlbumMode" AS ENUM (
    'SIMPLE',
    'EVENT',
    'SCHOOL',
    'COLLABORATIVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StudentIdentificationMode" AS ENUM (
    'NONE',
    'MANUAL',
    'ROSTER_OPTIONAL',
    'ROSTER_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizerCommissionAppliesTo" AS ENUM (
    'PREVENTA',
    'POST_EVENT',
    'EXTRAS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Retention cleanup pipeline
-- ---------------------------------------------------------------------------
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupStatus" "AlbumCleanupStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupPendingAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupStartedAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupCompletedAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupLastError" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupBlockReason" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "cleanupPhotosProcessed" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Album mode / packs / test visibility
-- ---------------------------------------------------------------------------
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "mode" "AlbumMode" NOT NULL DEFAULT 'SIMPLE';
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "albumPackPayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- School / face-bulk / organizer commission (Album scalars only)
-- ---------------------------------------------------------------------------
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "academicYearId" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "selectedCourseKeys" JSONB;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "enableFaceBulkPurchase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "faceBulkPriceCents" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "studentIdentificationMode" "StudentIdentificationMode";
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "allowManualStudentFallback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "organizerCommissionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "organizerCommissionPercentage" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "organizerCommissionAppliesTo" "OrganizerCommissionAppliesTo"[] NOT NULL DEFAULT ARRAY['PREVENTA']::"OrganizerCommissionAppliesTo"[];

-- ---------------------------------------------------------------------------
-- Indexes expected by schema (idempotent)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Album_cleanupStatus_idx" ON "Album"("cleanupStatus");
CREATE INDEX IF NOT EXISTS "Album_academicYearId_idx" ON "Album"("academicYearId");
