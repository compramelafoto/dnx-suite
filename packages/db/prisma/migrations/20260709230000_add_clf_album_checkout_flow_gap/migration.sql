-- CLF album → photos → cart → checkout flow gap (staging Neon ep-round-fog)
-- Residual blockers:
--   P2021 PackDefinition           → GET /album/[slug] (listActivePacksForPublicCatalog)
--   P2022 Photo.previewWatermarkedKey → GET /api/photos/[id]/view
--   P2022 Photo.variantsStatus     → same photo view select (next failure without it)
--
-- Cart/checkout URLs already exist in monorepo (legacy parity):
--   /a/{albumId}/comprar  and  /a/{albumId}/comprar/resumen
--   (/cart, /carrito, /checkout do NOT exist in legacy either)
--
-- Forward-only, additive, idempotent. Preserves existing rows.
-- Do NOT apply to production yet.
--
-- Scope: PackDefinition + BenefitDefinition (+ enums) and Photo watermark/variant cols.
-- Skips CatalogProduct / AlbumCatalogProduct FKs (tables absent on staging).
-- Skips PackPurchaseEntitlement / RedemptionSession (not required to open album with photos).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "PackBenefitKind" AS ENUM ('DIGITAL', 'PHYSICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BenefitTemplatePolicy" AS ENUM ('NONE', 'REQUIRED', 'OPTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BenefitSelectionMode" AS ENUM ('SINGLE_PHOTO', 'MULTI_PHOTO_FIXED', 'ALBUM_CHOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PackAvailabilityPhase" AS ENUM ('PRE_UPLOAD', 'POST_UPLOAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PhotoVariantsStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- PackDefinition (preventa/canjeable catalog queried on public album page)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PackDefinition" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "redemptionDeadlineAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "priceClientArs" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverImageUrl" TEXT,
    "availabilityPhase" "PackAvailabilityPhase",
    "sourceCatalogProductId" INTEGER,
    "sourceAlbumCatalogProductId" INTEGER,
    "sourceCatalogSyncedAt" TIMESTAMP(3),
    "sourceCatalogVersionSnapshot" JSONB,

    CONSTRAINT "PackDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BenefitDefinition" (
    "id" SERIAL NOT NULL,
    "packDefinitionId" INTEGER NOT NULL,
    "kind" "PackBenefitKind" NOT NULL,
    "includedQuantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "photographerProductId" INTEGER,
    "templatePolicy" "BenefitTemplatePolicy" NOT NULL DEFAULT 'NONE',
    "templateId" INTEGER,
    "extraUnitPriceOverrideArs" INTEGER,
    "requiredPhotoCount" INTEGER NOT NULL DEFAULT 1,
    "selectionMode" "BenefitSelectionMode" NOT NULL DEFAULT 'SINGLE_PHOTO',
    "maxPhotosPerUnit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regularUnitPriceAfterPreventaArs" INTEGER,

    CONSTRAINT "BenefitDefinition_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Photo columns required by /api/photos/[id]/view select
-- ---------------------------------------------------------------------------
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "previewWatermarkedKey" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "variantsVersion" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "variantsGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "variantsStatus" "PhotoVariantsStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "variantsError" TEXT;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "PackDefinition_sourceAlbumCatalogProductId_key"
  ON "PackDefinition"("sourceAlbumCatalogProductId");
CREATE INDEX IF NOT EXISTS "PackDefinition_albumId_idx" ON "PackDefinition"("albumId");
CREATE INDEX IF NOT EXISTS "PackDefinition_albumId_isActive_idx" ON "PackDefinition"("albumId", "isActive");
CREATE INDEX IF NOT EXISTS "PackDefinition_sourceCatalogProductId_idx" ON "PackDefinition"("sourceCatalogProductId");
CREATE INDEX IF NOT EXISTS "PackDefinition_sourceAlbumCatalogProductId_idx" ON "PackDefinition"("sourceAlbumCatalogProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "PackDefinition_albumId_sourceCatalogProductId_key"
  ON "PackDefinition"("albumId", "sourceCatalogProductId");

CREATE INDEX IF NOT EXISTS "BenefitDefinition_packDefinitionId_idx" ON "BenefitDefinition"("packDefinitionId");
CREATE INDEX IF NOT EXISTS "BenefitDefinition_photographerProductId_idx" ON "BenefitDefinition"("photographerProductId");
CREATE INDEX IF NOT EXISTS "BenefitDefinition_templateId_idx" ON "BenefitDefinition"("templateId");

CREATE INDEX IF NOT EXISTS "Photo_variantsStatus_createdAt_idx" ON "Photo"("variantsStatus", "createdAt");

-- ---------------------------------------------------------------------------
-- Foreign keys (existing deps only; no CatalogProduct / AlbumCatalogProduct)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "PackDefinition"
    ADD CONSTRAINT "PackDefinition_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BenefitDefinition"
    ADD CONSTRAINT "BenefitDefinition_packDefinitionId_fkey"
    FOREIGN KEY ("packDefinitionId") REFERENCES "PackDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BenefitDefinition"
    ADD CONSTRAINT "BenefitDefinition_photographerProductId_fkey"
    FOREIGN KEY ("photographerProductId") REFERENCES "PhotographerProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BenefitDefinition"
    ADD CONSTRAINT "BenefitDefinition_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
