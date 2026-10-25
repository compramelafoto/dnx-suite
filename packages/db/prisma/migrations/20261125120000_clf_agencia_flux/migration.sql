-- Modo agencia de CompraMeLaFoto (etapa 3a): puerta de DNX FLUX.
-- Crea AgencyLinkCode, AgencyDeviceKey y AgencyFluxUpload; agrega "agencyDeviceKeyId" a "CameraIngestJob" y los
-- valores FLUX (AlbumPhotoIngestSource) y AWAITING_FILTER (CameraIngestJobStatus).
-- No toca filas existentes. Idempotente. Schema compartido: se aplica a mano ANTES del deploy.
-- "CameraIngestJob" y sus enums existen sólo en la base de producción de CLF: en las otras bases esos bloques no hacen nada.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyLinkCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "deviceKeyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyDeviceKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyDeviceKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyFluxUpload" (
    "id" TEXT NOT NULL,
    "deviceKeyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "rawKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentSha256" TEXT,
    "declaredLat" DOUBLE PRECISION,
    "declaredLng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "ingestJobId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyFluxUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyLinkCode_codeHash_key" ON "AgencyLinkCode"("codeHash");
CREATE INDEX IF NOT EXISTS "AgencyLinkCode_userId_idx" ON "AgencyLinkCode"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyDeviceKey_keyHash_key" ON "AgencyDeviceKey"("keyHash");
CREATE INDEX IF NOT EXISTS "AgencyDeviceKey_userId_idx" ON "AgencyDeviceKey"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyFluxUpload_rawKey_key" ON "AgencyFluxUpload"("rawKey");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_deviceKeyId_idx" ON "AgencyFluxUpload"("deviceKeyId");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_userId_albumId_contentSha256_idx" ON "AgencyFluxUpload"("userId", "albumId", "contentSha256");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_userId_albumId_originalFilename_idx" ON "AgencyFluxUpload"("userId", "albumId", "originalFilename");

-- AddForeignKey (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyLinkCode_userId_fkey') THEN
    ALTER TABLE "AgencyLinkCode" ADD CONSTRAINT "AgencyLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyDeviceKey_userId_fkey') THEN
    ALTER TABLE "AgencyDeviceKey" ADD CONSTRAINT "AgencyDeviceKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyFluxUpload_deviceKeyId_fkey') THEN
    ALTER TABLE "AgencyFluxUpload" ADD CONSTRAINT "AgencyFluxUpload_deviceKeyId_fkey" FOREIGN KEY ("deviceKeyId") REFERENCES "AgencyDeviceKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Sólo donde existe la fila de ingesta (producción de CLF).
DO $$ BEGIN
  IF to_regclass('"CameraIngestJob"') IS NOT NULL THEN
    ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "agencyDeviceKeyId" INTEGER;
  END IF;
END $$;

-- AlterEnum. ADD VALUE no puede usarse en la misma transacción en que se agrega: acá no se usa.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlbumPhotoIngestSource') THEN
    ALTER TYPE "AlbumPhotoIngestSource" ADD VALUE IF NOT EXISTS 'FLUX';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CameraIngestJobStatus') THEN
    ALTER TYPE "CameraIngestJobStatus" ADD VALUE IF NOT EXISTS 'AWAITING_FILTER';
  END IF;
END $$;
