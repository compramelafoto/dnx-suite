-- Drop previous queue definition to align con el nuevo modelo
DROP TABLE IF EXISTS "ZipGenerationJob";
DROP TYPE IF EXISTS "ZipJobType";
DROP TYPE IF EXISTS "ZipJobStatus";

CREATE TYPE "ZipJobType" AS ENUM (
  'ORDER_DOWNLOAD',
  'ALBUM_DOWNLOAD',
  'CUSTOM_PHOTOS'
);

CREATE TYPE "ZipJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "ZipGenerationJob" (
  "id" TEXT PRIMARY KEY,
  "type" "ZipJobType" NOT NULL,
  "status" "ZipJobStatus" NOT NULL DEFAULT 'PENDING',
  "orderId" INTEGER,
  "albumId" INTEGER,
  "requesterUserId" INTEGER,
  "photoIds" TEXT[] NOT NULL DEFAULT '{}',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "processedItems" INTEGER NOT NULL DEFAULT 0,
  "meta" JSONB,
  "r2Key" TEXT,
  "zipUrl" TEXT,
  "error" TEXT,
  "expiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX "ZipGenerationJob_status_createdAt_idx" ON "ZipGenerationJob"("status", "createdAt");
CREATE INDEX "ZipGenerationJob_orderId_idx" ON "ZipGenerationJob"("orderId");
CREATE INDEX "ZipGenerationJob_albumId_idx" ON "ZipGenerationJob"("albumId");
