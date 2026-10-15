-- CreateEnum
CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'READY', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'PAID_NO_STOCK');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "ProductStoreListing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellOnline" BOOLEAN NOT NULL DEFAULT false,
    "sellAtCounter" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT NOT NULL,
    "onlineTitle" TEXT,
    "onlineDescription" TEXT,
    "sizeChartImageUrl" TEXT,
    "weightGrams" INTEGER,
    "lengthCm" INTEGER,
    "widthCm" INTEGER,
    "heightCm" INTEGER,
    "maxPerOrder" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStoreListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "priceArs" DECIMAL(12,2),
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "pickupAddress" TEXT,
    "pickupHours" TEXT,
    "pickupInstructions" TEXT,
    "returnsPolicy" TEXT,
    "notifyEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "clientId" TEXT,
    "memberId" TEXT,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'PICKUP',
    "subtotalArs" DECIMAL(12,2) NOT NULL,
    "shippingArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalArs" DECIMAL(12,2) NOT NULL,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "holdExpiresAt" TIMESTAMP(3),
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "saleId" TEXT,
    "legalAcceptedAt" TIMESTAMP(3) NOT NULL,
    "legalVersion" TEXT NOT NULL,
    "clientIdempotencyKey" TEXT NOT NULL,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "productSlug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPriceArs" DECIMAL(12,2) NOT NULL,
    "lineTotalArs" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "StoreOrderStatus",
    "toStatus" "StoreOrderStatus" NOT NULL,
    "actorUserId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductStoreListing_productId_key" ON "ProductStoreListing"("productId");

-- CreateIndex
CREATE INDEX "ProductStoreListing_workspaceId_sellOnline_idx" ON "ProductStoreListing"("workspaceId", "sellOnline");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStoreListing_workspaceId_slug_key" ON "ProductStoreListing"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_workspaceId_sku_key" ON "ProductVariant"("workspaceId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_workspaceId_barcode_key" ON "ProductVariant"("workspaceId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_workspaceId_key" ON "StoreSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_publicId_key" ON "StoreOrder"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_mpPaymentId_key" ON "StoreOrder"("mpPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_saleId_key" ON "StoreOrder"("saleId");

-- CreateIndex
CREATE INDEX "StoreOrder_workspaceId_status_createdAt_idx" ON "StoreOrder"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StoreOrder_status_holdExpiresAt_idx" ON "StoreOrder"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "StoreOrder_workspaceId_buyerEmail_status_idx" ON "StoreOrder"("workspaceId", "buyerEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_workspaceId_orderNumber_key" ON "StoreOrder"("workspaceId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrder_workspaceId_clientIdempotencyKey_key" ON "StoreOrder"("workspaceId", "clientIdempotencyKey");

-- CreateIndex
CREATE INDEX "StoreOrderItem_orderId_idx" ON "StoreOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_productId_idx" ON "StoreOrderItem"("productId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_variantId_idx" ON "StoreOrderItem"("variantId");

-- CreateIndex
CREATE INDEX "StoreOrderEvent_orderId_createdAt_idx" ON "StoreOrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_idx" ON "StockMovement"("variantId");

-- CreateIndex
CREATE INDEX "SaleItem_variantId_idx" ON "SaleItem"("variantId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStoreListing" ADD CONSTRAINT "ProductStoreListing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStoreListing" ADD CONSTRAINT "ProductStoreListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderEvent" ADD CONSTRAINT "StoreOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

