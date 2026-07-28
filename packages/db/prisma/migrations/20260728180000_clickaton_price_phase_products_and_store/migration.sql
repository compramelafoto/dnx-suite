-- Etapa 8B: productos por fase de precio, media de producto, tienda (prep), inventario auditable.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "ClickatonRegistrationItemSourceType" AS ENUM (
  'TICKET_BASE',
  'PRICE_PHASE',
  'STORE_PURCHASE'
);

CREATE TYPE "ClickatonProductMediaType" AS ENUM (
  'PRIMARY',
  'GALLERY',
  'SIZE_CHART',
  'DETAIL',
  'PACKAGING',
  'IN_USE'
);

CREATE TYPE "ClickatonProductStoreStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'OUT_OF_STOCK',
  'HIDDEN',
  'ARCHIVED'
);

CREATE TYPE "ClickatonInventoryMovementType" AS ENUM (
  'INITIAL_STOCK',
  'ADMIN_ADJUSTMENT',
  'REGISTRATION_HOLD',
  'REGISTRATION_CONFIRMED',
  'REGISTRATION_RELEASED',
  'STORE_HOLD',
  'STORE_SALE',
  'STORE_RELEASED',
  'RETURN',
  'DAMAGED',
  'GIFT'
);

ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PRODUCT_IMAGE';
ALTER TYPE "DnxMediaAssetKind" ADD VALUE IF NOT EXISTS 'PRODUCT_SIZE_CHART';

ALTER TYPE "ClickatonItemFulfillmentStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

-- ---------------------------------------------------------------------------
-- ClickatonPricePhaseItem
-- ---------------------------------------------------------------------------

CREATE TABLE "ClickatonPricePhaseItem" (
  "id" TEXT NOT NULL,
  "pricePhaseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "requiresVariantChoice" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "isIncluded" BOOLEAN NOT NULL DEFAULT true,
  "stockLimit" INTEGER,
  "fulfillmentRequired" BOOLEAN NOT NULL DEFAULT true,
  "displayTitle" TEXT,
  "displayDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonPricePhaseItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonPricePhaseItem_pricePhaseId_productId_key"
  ON "ClickatonPricePhaseItem"("pricePhaseId", "productId");

CREATE INDEX "ClickatonPricePhaseItem_pricePhaseId_sortOrder_idx"
  ON "ClickatonPricePhaseItem"("pricePhaseId", "sortOrder");

CREATE INDEX "ClickatonPricePhaseItem_productId_idx"
  ON "ClickatonPricePhaseItem"("productId");

ALTER TABLE "ClickatonPricePhaseItem"
  ADD CONSTRAINT "ClickatonPricePhaseItem_pricePhaseId_fkey"
  FOREIGN KEY ("pricePhaseId") REFERENCES "ClickatonRegistrationPricePhase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonPricePhaseItem"
  ADD CONSTRAINT "ClickatonPricePhaseItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ClickatonProduct"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ClickatonProduct — media refs + store prep
-- ---------------------------------------------------------------------------

ALTER TABLE "ClickatonProduct"
  ADD COLUMN "primaryImageAssetId" TEXT,
  ADD COLUMN "sizeChartAssetId" TEXT,
  ADD COLUMN "sizeChartDescription" TEXT,
  ADD COLUMN "sizeChartInstructions" TEXT,
  ADD COLUMN "isStoreEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "storeStatus" "ClickatonProductStoreStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "storeSlug" TEXT,
  ADD COLUMN "storeTitle" TEXT,
  ADD COLUMN "storeDescription" TEXT,
  ADD COLUMN "storePrice" INTEGER,
  ADD COLUMN "compareAtPrice" INTEGER,
  ADD COLUMN "storeCurrency" TEXT NOT NULL DEFAULT 'ARS',
  ADD COLUMN "taxCategory" TEXT,
  ADD COLUMN "requiresShipping" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowPickup" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "weightGrams" INTEGER,
  ADD COLUMN "storeSortOrder" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ClickatonProduct_editionId_storeSlug_key"
  ON "ClickatonProduct"("editionId", "storeSlug");

CREATE INDEX "ClickatonProduct_editionId_isStoreEnabled_storeStatus_idx"
  ON "ClickatonProduct"("editionId", "isStoreEnabled", "storeStatus");

CREATE INDEX "ClickatonProduct_primaryImageAssetId_idx"
  ON "ClickatonProduct"("primaryImageAssetId");

CREATE INDEX "ClickatonProduct_sizeChartAssetId_idx"
  ON "ClickatonProduct"("sizeChartAssetId");

-- ---------------------------------------------------------------------------
-- ClickatonProductMedia
-- ---------------------------------------------------------------------------

CREATE TABLE "ClickatonProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "mediaType" "ClickatonProductMediaType" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "altText" TEXT,
  "caption" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonProductMedia_productId_mediaType_sortOrder_idx"
  ON "ClickatonProductMedia"("productId", "mediaType", "sortOrder");

CREATE INDEX "ClickatonProductMedia_assetId_idx"
  ON "ClickatonProductMedia"("assetId");

CREATE UNIQUE INDEX "ClickatonProductMedia_productId_assetId_mediaType_key"
  ON "ClickatonProductMedia"("productId", "assetId", "mediaType");

ALTER TABLE "ClickatonProductMedia"
  ADD CONSTRAINT "ClickatonProductMedia_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ClickatonProduct"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ClickatonInventoryMovement
-- ---------------------------------------------------------------------------

CREATE TABLE "ClickatonInventoryMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "movementType" "ClickatonInventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "reason" TEXT,
  "createdByUserId" INTEGER,
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClickatonInventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonInventoryMovement_idempotencyKey_key"
  ON "ClickatonInventoryMovement"("idempotencyKey");

CREATE INDEX "ClickatonInventoryMovement_productId_createdAt_idx"
  ON "ClickatonInventoryMovement"("productId", "createdAt");

CREATE INDEX "ClickatonInventoryMovement_variantId_createdAt_idx"
  ON "ClickatonInventoryMovement"("variantId", "createdAt");

CREATE INDEX "ClickatonInventoryMovement_sourceType_sourceId_idx"
  ON "ClickatonInventoryMovement"("sourceType", "sourceId");

CREATE INDEX "ClickatonInventoryMovement_movementType_createdAt_idx"
  ON "ClickatonInventoryMovement"("movementType", "createdAt");

ALTER TABLE "ClickatonInventoryMovement"
  ADD CONSTRAINT "ClickatonInventoryMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ClickatonProduct"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonInventoryMovement"
  ADD CONSTRAINT "ClickatonInventoryMovement_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ClickatonProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonInventoryMovement"
  ADD CONSTRAINT "ClickatonInventoryMovement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ClickatonRegistrationItem — snapshots + source
-- ---------------------------------------------------------------------------

ALTER TABLE "ClickatonRegistrationItem"
  ADD COLUMN "pricePhaseItemId" TEXT,
  ADD COLUMN "sourceType" "ClickatonRegistrationItemSourceType" NOT NULL DEFAULT 'TICKET_BASE',
  ADD COLUMN "productNameSnapshot" TEXT,
  ADD COLUMN "productDescriptionSnapshot" TEXT,
  ADD COLUMN "imageAssetIdSnapshot" TEXT,
  ADD COLUMN "sizeChartAssetIdSnapshot" TEXT,
  ADD COLUMN "fulfillmentNotes" TEXT,
  ADD COLUMN "fulfillmentLocation" TEXT;

CREATE INDEX "ClickatonRegistrationItem_pricePhaseItemId_idx"
  ON "ClickatonRegistrationItem"("pricePhaseItemId");

CREATE INDEX "ClickatonRegistrationItem_sourceType_idx"
  ON "ClickatonRegistrationItem"("sourceType");
