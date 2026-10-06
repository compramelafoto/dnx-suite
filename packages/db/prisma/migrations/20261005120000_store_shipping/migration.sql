-- AlterEnum
ALTER TYPE "StoreOrderStatus" ADD VALUE IF NOT EXISTS 'SHIPPED';

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingAddressJson" JSONB,
ADD COLUMN     "shippingAgencyJson" JSONB,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "shippingQuoteJson" JSONB,
ADD COLUMN     "shippingSource" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "StoreShippingSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "homeDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "branchDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'TABLE',
    "tableAsFallback" BOOLEAN NOT NULL DEFAULT true,
    "originPostalCode" TEXT,
    "surchargeKind" TEXT NOT NULL DEFAULT 'NONE',
    "surchargeValue" INTEGER NOT NULL DEFAULT 0,
    "packagingGrams" INTEGER NOT NULL DEFAULT 0,
    "defaultUnitGrams" INTEGER NOT NULL DEFAULT 500,
    "boxLengthCm" INTEGER NOT NULL DEFAULT 30,
    "boxWidthCm" INTEGER NOT NULL DEFAULT 20,
    "boxHeightCm" INTEGER NOT NULL DEFAULT 10,
    "handlingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreShippingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreShippingZone" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCodes" TEXT[],
    "provinceCodes" TEXT[],
    "isRestOfCountry" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "maxGrams" INTEGER NOT NULL,
    "priceArs" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "StoreShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreShippingSettings_workspaceId_key" ON "StoreShippingSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "StoreShippingZone_workspaceId_sortOrder_idx" ON "StoreShippingZone"("workspaceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoreShippingRate_zoneId_maxGrams_key" ON "StoreShippingRate"("zoneId", "maxGrams");

-- AddForeignKey
ALTER TABLE "StoreShippingSettings" ADD CONSTRAINT "StoreShippingSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShippingZone" ADD CONSTRAINT "StoreShippingZone_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreShippingRate" ADD CONSTRAINT "StoreShippingRate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "StoreShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

