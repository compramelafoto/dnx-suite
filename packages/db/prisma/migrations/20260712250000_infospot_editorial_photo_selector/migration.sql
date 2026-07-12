-- Info Spot: Selector Editorial de Fotografías CLF.
-- No toca originales comerciales ni sync de eventos/coberturas estructurales.

-- 1) Usage FEATURED en assets legacy
ALTER TYPE "InfoSpotArticleAssetUsage" ADD VALUE 'FEATURED';

-- 2) Portada override en artículos
ALTER TABLE "InfoSpotArticle"
  ADD COLUMN "coverOverridden" BOOLEAN NOT NULL DEFAULT false;

-- 3) Enums
CREATE TYPE "InfoSpotEditorialPhotoProcessStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'READY', 'FAILED', 'UNAVAILABLE'
);
CREATE TYPE "InfoSpotEditorialLicenseStatus" AS ENUM (
  'PENDING', 'AUTHORIZED', 'REVOKED', 'UNKNOWN'
);
CREATE TYPE "InfoSpotEditorialUsageStatus" AS ENUM (
  'ACTIVE', 'REMOVED', 'BLOCKED'
);
CREATE TYPE "InfoSpotEditorialPhotoUsageType" AS ENUM (
  'COVER', 'INLINE', 'GALLERY', 'FEATURED'
);

-- 4) Foto editorial base
CREATE TABLE "InfoSpotEditorialPhoto" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT,
  "eventId" TEXT,
  "contentOriginId" TEXT,
  "sourcePhotoExternalId" TEXT NOT NULL,
  "sourceAlbumExternalId" TEXT NOT NULL,
  "photographerExternalId" TEXT,
  "photographerUserId" INTEGER,
  "photographerName" TEXT NOT NULL,
  "photographerProfileUrl" TEXT,
  "albumUrl" TEXT,
  "purchaseUrl" TEXT,
  "commercialStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "editorialLicenseStatus" "InfoSpotEditorialLicenseStatus" NOT NULL DEFAULT 'PENDING',
  "editorialUsageStatus" "InfoSpotEditorialUsageStatus" NOT NULL DEFAULT 'ACTIVE',
  "processStatus" "InfoSpotEditorialPhotoProcessStatus" NOT NULL DEFAULT 'PENDING',
  "processError" TEXT,
  "sourceStorageKey" TEXT,
  "editorialMasterKey" TEXT,
  "credit" TEXT NOT NULL,
  "copyrightText" TEXT,
  "deliveryAssetId" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotEditorialPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotEditorialPhoto_sourcePhotoExternalId_key"
  ON "InfoSpotEditorialPhoto"("sourcePhotoExternalId");
CREATE INDEX "InfoSpotEditorialPhoto_sourceAlbumExternalId_idx"
  ON "InfoSpotEditorialPhoto"("sourceAlbumExternalId");
CREATE INDEX "InfoSpotEditorialPhoto_coverageId_idx" ON "InfoSpotEditorialPhoto"("coverageId");
CREATE INDEX "InfoSpotEditorialPhoto_eventId_idx" ON "InfoSpotEditorialPhoto"("eventId");
CREATE INDEX "InfoSpotEditorialPhoto_commercialStatus_idx" ON "InfoSpotEditorialPhoto"("commercialStatus");
CREATE INDEX "InfoSpotEditorialPhoto_processStatus_idx" ON "InfoSpotEditorialPhoto"("processStatus");
CREATE INDEX "InfoSpotEditorialPhoto_editorialLicenseStatus_idx"
  ON "InfoSpotEditorialPhoto"("editorialLicenseStatus");
CREATE INDEX "InfoSpotEditorialPhoto_deliveryAssetId_idx" ON "InfoSpotEditorialPhoto"("deliveryAssetId");
CREATE INDEX "InfoSpotEditorialPhoto_photographerUserId_idx"
  ON "InfoSpotEditorialPhoto"("photographerUserId");

ALTER TABLE "InfoSpotEditorialPhoto"
  ADD CONSTRAINT "InfoSpotEditorialPhoto_coverageId_fkey"
  FOREIGN KEY ("coverageId") REFERENCES "InfoSpotCoverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InfoSpotEditorialPhoto"
  ADD CONSTRAINT "InfoSpotEditorialPhoto_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InfoSpotEditorialPhoto"
  ADD CONSTRAINT "InfoSpotEditorialPhoto_deliveryAssetId_fkey"
  FOREIGN KEY ("deliveryAssetId") REFERENCES "InfoSpotEditorialAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Variantes responsive
CREATE TABLE "InfoSpotEditorialPhotoVariant" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'webp',
  "r2Key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "bytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InfoSpotEditorialPhotoVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotEditorialPhotoVariant_photoId_width_format_key"
  ON "InfoSpotEditorialPhotoVariant"("photoId", "width", "format");
CREATE INDEX "InfoSpotEditorialPhotoVariant_photoId_idx" ON "InfoSpotEditorialPhotoVariant"("photoId");

ALTER TABLE "InfoSpotEditorialPhotoVariant"
  ADD CONSTRAINT "InfoSpotEditorialPhotoVariant_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "InfoSpotEditorialPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) Usages
CREATE TABLE "InfoSpotEditorialPhotoUsage" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "usageType" "InfoSpotEditorialPhotoUsageType" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "caption" TEXT,
  "altText" TEXT,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "displaySize" TEXT DEFAULT 'wide',
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotEditorialPhotoUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotEditorialPhotoUsage_articleId_photoId_usageType_key"
  ON "InfoSpotEditorialPhotoUsage"("articleId", "photoId", "usageType");
CREATE INDEX "InfoSpotEditorialPhotoUsage_articleId_usageType_sortOrder_idx"
  ON "InfoSpotEditorialPhotoUsage"("articleId", "usageType", "sortOrder");
CREATE INDEX "InfoSpotEditorialPhotoUsage_photoId_idx" ON "InfoSpotEditorialPhotoUsage"("photoId");
CREATE INDEX "InfoSpotEditorialPhotoUsage_createdByUserId_idx"
  ON "InfoSpotEditorialPhotoUsage"("createdByUserId");
CREATE INDEX "InfoSpotEditorialPhotoUsage_isCover_idx" ON "InfoSpotEditorialPhotoUsage"("isCover");

ALTER TABLE "InfoSpotEditorialPhotoUsage"
  ADD CONSTRAINT "InfoSpotEditorialPhotoUsage_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotEditorialPhotoUsage"
  ADD CONSTRAINT "InfoSpotEditorialPhotoUsage_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "InfoSpotEditorialPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotEditorialPhotoUsage"
  ADD CONSTRAINT "InfoSpotEditorialPhotoUsage_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "InfoSpotEditorialPhoto" IS
  'Derivado editorial de foto CLF. Nunca almacena ni expone el original comercial.';
