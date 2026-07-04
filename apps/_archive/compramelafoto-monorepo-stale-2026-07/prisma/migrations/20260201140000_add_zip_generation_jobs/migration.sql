-- Create enums for ZIP job tracking (ignorar si ya existen por baseline)
DO $$ BEGIN
  CREATE TYPE "ZipJobType" AS ENUM ('CLIENT_DIGITAL', 'LAB_PRINT', 'ALBUM_EXPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ZipJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create queue table (IF NOT EXISTS para compatibilidad con baseline)
CREATE TABLE IF NOT EXISTS "ZipGenerationJob" (
  "id" SERIAL PRIMARY KEY,
  "jobType" "ZipJobType" NOT NULL,
  "orderId" INTEGER,
  "albumId" INTEGER,
  "photoIds" INTEGER[] NOT NULL DEFAULT '{}',
  "status" "ZipJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalFiles" INTEGER NOT NULL DEFAULT 0,
  "processedFiles" INTEGER NOT NULL DEFAULT 0,
  "zipKey" TEXT,
  "zipUrl" TEXT,
  "errorMessage" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "ZipGenerationJob_status_createdAt_idx" ON "ZipGenerationJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ZipGenerationJob_orderId_idx" ON "ZipGenerationJob"("orderId");
CREATE INDEX IF NOT EXISTS "ZipGenerationJob_albumId_idx" ON "ZipGenerationJob"("albumId");
