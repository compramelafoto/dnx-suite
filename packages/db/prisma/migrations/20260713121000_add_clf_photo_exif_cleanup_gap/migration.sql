-- CLF Photo EXIF / cleanup gap (staging Neon ep-round-fog)
-- Residual after Order.origin gap: Prisma Photo model expects EXIF/cleanup columns
-- that were never migrated on staging. Lab EXIF pipeline can wait; columns are
-- additive defaults so album checkout includes and admin health queries don't 500.
--
-- Forward-only, additive, idempotent. Do NOT apply to production yet.

DO $$ BEGIN
  CREATE TYPE "PhotoExifMetadataStatus" AS ENUM (
    'PENDING',
    'ANALYZED',
    'NO_EXIF',
    'FAILED',
    'SKIPPED_EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PhotoStorageCleanupStatus" AS ENUM (
    'ACTIVE',
    'STORAGE_PURGED',
    'PURGED_WITH_REFERENCES'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "exifMetadataStatus" "PhotoExifMetadataStatus" DEFAULT 'PENDING';
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "exifMetadataAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "storageDeletedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "metadataDeletedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "storageCleanupStatus" "PhotoStorageCleanupStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Photo_exifMetadataStatus_createdAt_idx"
  ON "Photo"("exifMetadataStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Photo_storageCleanupStatus_idx"
  ON "Photo"("storageCleanupStatus");
CREATE INDEX IF NOT EXISTS "Photo_storageDeletedAt_idx"
  ON "Photo"("storageDeletedAt");
