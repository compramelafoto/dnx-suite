-- Info Spot Paso 4: relación noticia ↔ assets editoriales + auditoría de vínculo CLF

-- CreateEnum
CREATE TYPE "InfoSpotArticleAssetUsage" AS ENUM ('COVER', 'INLINE', 'GALLERY');

-- AlterTable InfoSpotEditorialAsset
ALTER TABLE "InfoSpotEditorialAsset" ADD COLUMN IF NOT EXISTS "r2Key" TEXT;
ALTER TABLE "InfoSpotEditorialAsset" ADD COLUMN IF NOT EXISTS "importedByUserId" INTEGER;
ALTER TABLE "InfoSpotEditorialAsset" ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3);

-- AlterTable InfoSpotArticle (auditoría de vínculo evento/álbum)
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "eventLinkedByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "eventLinkedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfoSpotArticleAsset" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "usageType" "InfoSpotArticleAssetUsage" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "captionOverride" TEXT,
    "selectedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotArticleAsset_pkey" PRIMARY KEY ("id")
);

-- Unique global editorial asset per CLF photo (idempotencia de copia)
CREATE UNIQUE INDEX IF NOT EXISTS "InfoSpotEditorialAsset_sourceType_sourcePhotoId_key"
  ON "InfoSpotEditorialAsset"("sourceType", "sourcePhotoId");

-- Indexes InfoSpotArticleAsset
CREATE UNIQUE INDEX IF NOT EXISTS "InfoSpotArticleAsset_articleId_assetId_usageType_key"
  ON "InfoSpotArticleAsset"("articleId", "assetId", "usageType");

CREATE INDEX IF NOT EXISTS "InfoSpotArticleAsset_articleId_usageType_sortOrder_idx"
  ON "InfoSpotArticleAsset"("articleId", "usageType", "sortOrder");

CREATE INDEX IF NOT EXISTS "InfoSpotArticleAsset_assetId_idx"
  ON "InfoSpotArticleAsset"("assetId");

CREATE INDEX IF NOT EXISTS "InfoSpotArticleAsset_selectedByUserId_idx"
  ON "InfoSpotArticleAsset"("selectedByUserId");

-- FKs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InfoSpotArticleAsset_articleId_fkey'
  ) THEN
    ALTER TABLE "InfoSpotArticleAsset"
      ADD CONSTRAINT "InfoSpotArticleAsset_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InfoSpotArticleAsset_assetId_fkey'
  ) THEN
    ALTER TABLE "InfoSpotArticleAsset"
      ADD CONSTRAINT "InfoSpotArticleAsset_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "InfoSpotEditorialAsset"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
