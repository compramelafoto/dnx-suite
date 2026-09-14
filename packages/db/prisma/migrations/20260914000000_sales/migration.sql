-- Etapa 1b, Tarea 1: Ventas. Puramente aditiva — seis tablas nuevas, ninguna columna
-- existente modificada, ningún enum nuevo (el esquema lo comparten cinco aplicaciones).

CREATE TABLE "GlobalProduct" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdByWorkspaceId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GlobalProduct_barcode_key" ON "GlobalProduct"("barcode");
-- Sin clave foránea a Workspace: la ficha del catálogo maestro sobrevive aunque ese
-- workspace se elimine. Es una referencia suelta, a propósito.

CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductCategory_workspaceId_name_key" ON "ProductCategory"("workspaceId", "name");
CREATE INDEX "ProductCategory_workspaceId_isActive_idx" ON "ProductCategory"("workspaceId", "isActive");
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PRODUCTO',
    "sku" TEXT,
    "barcode" TEXT,
    "globalProductId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceArs" DECIMAL(12,2) NOT NULL,
    "costArs" DECIMAL(12,2),
    "tracksStock" BOOLEAN NOT NULL DEFAULT true,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minStockQty" INTEGER,
    "imageUrl" TEXT,
    "supplierName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
-- Postgres no considera iguales dos NULL, así que muchos productos sin "sku" conviven
-- sin chocar contra este único.
CREATE UNIQUE INDEX "Product_workspaceId_sku_key" ON "Product"("workspaceId", "sku");
CREATE INDEX "Product_workspaceId_isActive_idx" ON "Product"("workspaceId", "isActive");
CREATE INDEX "Product_workspaceId_categoryId_idx" ON "Product"("workspaceId", "categoryId");
CREATE INDEX "Product_workspaceId_barcode_idx" ON "Product"("workspaceId", "barcode");
CREATE INDEX "Product_globalProductId_idx" ON "Product"("globalProductId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_globalProductId_fkey"
    FOREIGN KEY ("globalProductId") REFERENCES "GlobalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "unitCostArs" DECIMAL(12,2),
    "sourceModule" TEXT,
    "sourceRef" TEXT,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_workspaceId_createdAt_idx" ON "StockMovement"("workspaceId", "createdAt");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "saleNumber" INTEGER NOT NULL,
    "clientId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETADA',
    "subtotalArs" DECIMAL(12,2) NOT NULL,
    "discountArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalArs" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "cashMovementId" TEXT,
    "note" TEXT,
    "externalInvoiceRef" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" INTEGER,
    "voidReason" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Sale_cashMovementId_key" ON "Sale"("cashMovementId");
CREATE UNIQUE INDEX "Sale_workspaceId_saleNumber_key" ON "Sale"("workspaceId", "saleNumber");
CREATE INDEX "Sale_workspaceId_occurredAt_idx" ON "Sale"("workspaceId", "occurredAt");
CREATE INDEX "Sale_clientId_occurredAt_idx" ON "Sale"("clientId", "occurredAt");
CREATE INDEX "Sale_workspaceId_status_idx" ON "Sale"("workspaceId", "status");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceArs" DECIMAL(12,2) NOT NULL,
    "unitCostArs" DECIMAL(12,2),
    "lineTotalArs" DECIMAL(12,2) NOT NULL,
    "priceWasOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
