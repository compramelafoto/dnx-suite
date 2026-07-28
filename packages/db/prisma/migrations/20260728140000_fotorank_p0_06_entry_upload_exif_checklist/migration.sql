-- CreateEnum
CREATE TYPE "FotorankContestEntryStatus" AS ENUM ('DRAFT', 'UPLOADED', 'PROCESSING', 'REQUIRES_REVIEW', 'READY_TO_CONFIRM', 'CONFIRMED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FotorankTechnicalSummaryStatus" AS ENUM ('NOT_EVALUATED', 'APPROVED', 'APPROVED_WITH_WARNINGS', 'REQUIRES_REVIEW', 'TECHNICALLY_REJECTED');

-- CreateEnum
CREATE TYPE "FotorankManualReviewStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REPLACEMENT_REQUESTED', 'REJECTED', 'CLEARED_WARNING');

-- CreateEnum
CREATE TYPE "FotorankMetadataStatus" AS ENUM ('EXTRACTED', 'PARTIAL', 'NOT_AVAILABLE', 'INVALID', 'FAILED');

-- CreateEnum
CREATE TYPE "FotorankCheckStatus" AS ENUM ('PASS', 'WARNING', 'FAIL', 'NOT_AVAILABLE', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "FotorankCheckGroup" AS ENUM ('FILE', 'REGISTRATION', 'CONTEST', 'CATEGORY', 'METADATA', 'DUPLICATE', 'SECURITY', 'TIMING');

-- CreateEnum
CREATE TYPE "FotorankEntryReviewDecision" AS ENUM ('APPROVED', 'REPLACEMENT_REQUESTED', 'REJECTED', 'CLEARED_WARNING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FotorankEntryAssetKind" ADD VALUE 'NORMALIZED';
ALTER TYPE "FotorankEntryAssetKind" ADD VALUE 'JURY_PREVIEW';
ALTER TYPE "FotorankEntryAssetKind" ADD VALUE 'PUBLIC_PREVIEW';
ALTER TYPE "FotorankEntryAssetKind" ADD VALUE 'WATERMARKED';

-- DropIndex
DROP INDEX "FotorankContestEntryAsset_entryId_kind_key";

-- AlterTable
ALTER TABLE "FotorankContest" ADD COLUMN     "uploadPolicyJson" JSONB;

-- AlterTable
ALTER TABLE "FotorankContestEntry" ADD COLUMN     "activeAssetId" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "entryNumber" TEXT,
ADD COLUMN     "manualReviewStatus" "FotorankManualReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "registrationId" TEXT,
ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "status" "FotorankContestEntryStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "technicalSummaryJson" JSONB,
ADD COLUMN     "technicalSummaryStatus" "FotorankTechnicalSummaryStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ALTER COLUMN "imageUrl" SET DEFAULT '';

-- AlterTable FotorankContestEntryAsset — EXPAND (10A.1): no DROP of legacy columns.
-- Legacy `bucket` / `byteSize` retained until a later contract migration after validation.
-- See docs/clickaton/RELEASE_10A1_FOTORANK_P006_MIGRATION.md
ALTER TABLE "FotorankContestEntryAsset"
ADD COLUMN IF NOT EXISTS "extension" TEXT,
ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "originalFileName" TEXT,
ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "replacedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sourceOriginalAssetId" TEXT,
ADD COLUMN IF NOT EXISTS "storageBucket" TEXT,
ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'local_private',
ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL DEFAULT 1;

-- Idempotent backfill from legacy columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FotorankContestEntryAsset' AND column_name = 'bucket'
  ) THEN
    UPDATE "FotorankContestEntryAsset"
    SET "storageBucket" = COALESCE("storageBucket", "bucket")
    WHERE "storageBucket" IS NULL AND "bucket" IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'FotorankContestEntryAsset' AND column_name = 'byteSize'
  ) THEN
    UPDATE "FotorankContestEntryAsset"
    SET "fileSizeBytes" = COALESCE("fileSizeBytes", "byteSize")
    WHERE "fileSizeBytes" IS NULL AND "byteSize" IS NOT NULL;
  END IF;
END $$;

-- CreateTable
CREATE TABLE "FotorankContestEntryMetadata" (
    "id" TEXT NOT NULL,
    "entryAssetId" TEXT NOT NULL,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "lensModel" TEXT,
    "captureDate" TIMESTAMP(3),
    "digitizedDate" TIMESTAMP(3),
    "software" TEXT,
    "iso" TEXT,
    "aperture" TEXT,
    "shutterSpeed" TEXT,
    "focalLength" TEXT,
    "gpsLatitude" DOUBLE PRECISION,
    "gpsLongitude" DOUBLE PRECISION,
    "gpsAltitude" DOUBLE PRECISION,
    "orientation" TEXT,
    "colorSpace" TEXT,
    "metadataStatus" "FotorankMetadataStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "rawMetadataJson" JSONB,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestEntryMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestEntryCheck" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "assetId" TEXT,
    "checkCode" TEXT NOT NULL,
    "checkGroup" "FotorankCheckGroup" NOT NULL,
    "status" "FotorankCheckStatus" NOT NULL,
    "severity" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailsJson" JSONB,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleVersion" TEXT NOT NULL DEFAULT 'p0-06-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestEntryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestEntryReview" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "reviewerUserId" INTEGER NOT NULL,
    "decision" "FotorankEntryReviewDecision" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestEntryReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestEntryMetadata_entryAssetId_key" ON "FotorankContestEntryMetadata"("entryAssetId");

-- CreateIndex
CREATE INDEX "FotorankContestEntryMetadata_metadataStatus_idx" ON "FotorankContestEntryMetadata"("metadataStatus");

-- CreateIndex
CREATE INDEX "FotorankContestEntryMetadata_captureDate_idx" ON "FotorankContestEntryMetadata"("captureDate");

-- CreateIndex
CREATE INDEX "FotorankContestEntryCheck_entryId_checkGroup_idx" ON "FotorankContestEntryCheck"("entryId", "checkGroup");

-- CreateIndex
CREATE INDEX "FotorankContestEntryCheck_entryId_status_idx" ON "FotorankContestEntryCheck"("entryId", "status");

-- CreateIndex
CREATE INDEX "FotorankContestEntryCheck_assetId_idx" ON "FotorankContestEntryCheck"("assetId");

-- CreateIndex
CREATE INDEX "FotorankContestEntryCheck_checkCode_idx" ON "FotorankContestEntryCheck"("checkCode");

-- CreateIndex
CREATE INDEX "FotorankContestEntryReview_entryId_reviewedAt_idx" ON "FotorankContestEntryReview"("entryId", "reviewedAt");

-- CreateIndex
CREATE INDEX "FotorankContestEntryReview_reviewerUserId_idx" ON "FotorankContestEntryReview"("reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestEntry_registrationId_key" ON "FotorankContestEntry"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestEntry_activeAssetId_key" ON "FotorankContestEntry"("activeAssetId");

-- CreateIndex
CREATE INDEX "FotorankContestEntry_contestId_status_idx" ON "FotorankContestEntry"("contestId", "status");

-- CreateIndex
CREATE INDEX "FotorankContestEntry_authorUserId_idx" ON "FotorankContestEntry"("authorUserId");

-- CreateIndex
CREATE INDEX "FotorankContestEntry_technicalSummaryStatus_idx" ON "FotorankContestEntry"("technicalSummaryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestEntry_contestId_entryNumber_key" ON "FotorankContestEntry"("contestId", "entryNumber");

-- CreateIndex
CREATE INDEX "FotorankContestEntryAsset_entryId_isActive_idx" ON "FotorankContestEntryAsset"("entryId", "isActive");

-- CreateIndex
CREATE INDEX "FotorankContestEntryAsset_contestId_sha256_idx" ON "FotorankContestEntryAsset"("contestId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestEntryAsset_entryId_versionNumber_kind_key" ON "FotorankContestEntryAsset"("entryId", "versionNumber", "kind");

-- AddForeignKey
ALTER TABLE "FotorankContestEntryAsset" ADD CONSTRAINT "FotorankContestEntryAsset_sourceOriginalAssetId_fkey" FOREIGN KEY ("sourceOriginalAssetId") REFERENCES "FotorankContestEntryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntryMetadata" ADD CONSTRAINT "FotorankContestEntryMetadata_entryAssetId_fkey" FOREIGN KEY ("entryAssetId") REFERENCES "FotorankContestEntryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntryCheck" ADD CONSTRAINT "FotorankContestEntryCheck_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntryCheck" ADD CONSTRAINT "FotorankContestEntryCheck_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FotorankContestEntryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntryReview" ADD CONSTRAINT "FotorankContestEntryReview_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntryReview" ADD CONSTRAINT "FotorankContestEntryReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "FotorankContestRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_activeAssetId_fkey" FOREIGN KEY ("activeAssetId") REFERENCES "FotorankContestEntryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

