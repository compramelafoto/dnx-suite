-- Tienda: promo "N por $X", descuento del pedido y productor (dropshipping).

ALTER TABLE "FotofficeProveedor" ADD COLUMN "ordersFeedToken" TEXT;
CREATE UNIQUE INDEX "FotofficeProveedor_ordersFeedToken_key" ON "FotofficeProveedor"("ordersFeedToken");

ALTER TABLE "ProductStoreListing" ADD COLUMN "fulfillmentProveedorId" TEXT,
ADD COLUMN "printFileUrl" TEXT;
CREATE INDEX "ProductStoreListing_fulfillmentProveedorId_idx" ON "ProductStoreListing"("fulfillmentProveedorId");
ALTER TABLE "ProductStoreListing" ADD CONSTRAINT "ProductStoreListing_fulfillmentProveedorId_fkey" FOREIGN KEY ("fulfillmentProveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD COLUMN "printFileUrl" TEXT;

ALTER TABLE "StoreSettings" ADD COLUMN "bundleCategoryId" TEXT,
ADD COLUMN "bundleQty" INTEGER,
ADD COLUMN "bundlePriceArs" DECIMAL(12,2),
ADD COLUMN "bundleLabel" TEXT;

ALTER TABLE "StoreOrder" ADD COLUMN "discountArs" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "StoreOrderItem" ADD COLUMN "sku" TEXT,
ADD COLUMN "fulfillmentProveedorId" TEXT,
ADD COLUMN "printFileUrl" TEXT,
ADD COLUMN "fulfillmentSentAt" TIMESTAMP(3);
CREATE INDEX "StoreOrderItem_fulfillmentProveedorId_fulfillmentSentAt_idx" ON "StoreOrderItem"("fulfillmentProveedorId", "fulfillmentSentAt");
