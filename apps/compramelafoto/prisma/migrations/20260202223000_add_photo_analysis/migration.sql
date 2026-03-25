-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PhotoAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE IF EXISTS "Photo"
ADD COLUMN IF NOT EXISTS "analysisStatus" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "analysisError" TEXT,
ADD COLUMN IF NOT EXISTS "analyzedAt" TIMESTAMP(3);

-- Backfill existing photos
UPDATE "Photo"
SET "analysisStatus" = 'PENDING'
WHERE "analysisStatus" IS NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PhotoAnalysisJob" (
  "id" SERIAL PRIMARY KEY,
  "photoId" INTEGER NOT NULL UNIQUE,
  "status" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMP(3),
  "runAfter" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OcrToken" (
  "id" SERIAL PRIMARY KEY,
  "photoId" INTEGER NOT NULL,
  "textRaw" TEXT NOT NULL,
  "textNorm" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FaceDetection" (
  "id" SERIAL PRIMARY KEY,
  "photoId" INTEGER NOT NULL,
  "rekognitionFaceId" TEXT NOT NULL UNIQUE,
  "confidence" DOUBLE PRECISION,
  "bbox" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_status_idx" ON "PhotoAnalysisJob"("status");
CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_runAfter_idx" ON "PhotoAnalysisJob"("runAfter");
CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_lockedAt_idx" ON "PhotoAnalysisJob"("lockedAt");
CREATE INDEX IF NOT EXISTS "OcrToken_photoId_idx" ON "OcrToken"("photoId");
CREATE INDEX IF NOT EXISTS "OcrToken_textNorm_idx" ON "OcrToken"("textNorm");
CREATE INDEX IF NOT EXISTS "FaceDetection_photoId_idx" ON "FaceDetection"("photoId");

-- AddForeignKey
ALTER TABLE IF EXISTS "PhotoAnalysisJob"
ADD CONSTRAINT "PhotoAnalysisJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "OcrToken"
ADD CONSTRAINT "OcrToken_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "FaceDetection"
ADD CONSTRAINT "FaceDetection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
