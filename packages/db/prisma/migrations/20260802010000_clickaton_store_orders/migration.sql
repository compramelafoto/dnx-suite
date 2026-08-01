-- TIENDA Etapa 05: órdenes de tienda, ítems snapshot y holds de stock.
-- NO aplicar en producción desde este agente. Comando local/staging autorizado:
--   npx prisma migrate deploy  (solo en base autorizada)

CREATE TYPE "ClickatonStoreOrderStatus" AS ENUM (
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'PAYMENT_FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'READY_FOR_PICKUP',
  'SHIPPED',
  'DELIVERED'
);

CREATE TYPE "ClickatonStorePaymentStatus" AS ENUM (
  'CREATED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'REFUNDED',
  'CHARGED_BACK',
  'UNKNOWN'
);

CREATE TYPE "ClickatonStoreDeliveryMethod" AS ENUM (
  'PICKUP',
  'SHIPPING'
);

CREATE TYPE "ClickatonStoreHoldStatus" AS ENUM (
  'ACTIVE',
  'CAPTURED',
  'RELEASED',
  'EXPIRED'
);

CREATE TABLE "ClickatonStoreOrder" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "status" "ClickatonStoreOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentStatus" "ClickatonStorePaymentStatus" NOT NULL DEFAULT 'CREATED',
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "subtotalAmount" INTEGER NOT NULL,
  "deliveryAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL,
  "customerFirstName" TEXT NOT NULL,
  "customerLastName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "deliveryMethod" "ClickatonStoreDeliveryMethod" NOT NULL DEFAULT 'PICKUP',
  "deliveryData" JSONB,
  "legalVersion" TEXT NOT NULL,
  "legalAcceptedAt" TIMESTAMP(3) NOT NULL,
  "paymentProvider" TEXT,
  "paymentOrderId" TEXT,
  "paymentExternalReference" TEXT,
  "paymentIdempotencyKey" TEXT,
  "clientIdempotencyKey" TEXT NOT NULL,
  "commercialFingerprint" TEXT NOT NULL,
  "holdExpiresAt" TIMESTAMP(3),
  "editionId" TEXT,
  "financialDistributionSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonStoreOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonStoreOrder_publicId_key" ON "ClickatonStoreOrder"("publicId");
CREATE UNIQUE INDEX "ClickatonStoreOrder_paymentIdempotencyKey_key" ON "ClickatonStoreOrder"("paymentIdempotencyKey");
CREATE UNIQUE INDEX "ClickatonStoreOrder_clientIdempotencyKey_key" ON "ClickatonStoreOrder"("clientIdempotencyKey");
CREATE INDEX "ClickatonStoreOrder_status_createdAt_idx" ON "ClickatonStoreOrder"("status", "createdAt");
CREATE INDEX "ClickatonStoreOrder_paymentStatus_status_idx" ON "ClickatonStoreOrder"("paymentStatus", "status");
CREATE INDEX "ClickatonStoreOrder_customerEmail_createdAt_idx" ON "ClickatonStoreOrder"("customerEmail", "createdAt");
CREATE INDEX "ClickatonStoreOrder_editionId_idx" ON "ClickatonStoreOrder"("editionId");
CREATE INDEX "ClickatonStoreOrder_holdExpiresAt_status_idx" ON "ClickatonStoreOrder"("holdExpiresAt", "status");
CREATE INDEX "ClickatonStoreOrder_paymentOrderId_idx" ON "ClickatonStoreOrder"("paymentOrderId");
CREATE INDEX "ClickatonStoreOrder_commercialFingerprint_idx" ON "ClickatonStoreOrder"("commercialFingerprint");

CREATE TABLE "ClickatonStoreOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "variantNameSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT,
  "unitPriceAmount" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineSubtotalAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "imageUrlSnapshot" TEXT,
  "storeSlugSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClickatonStoreOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonStoreOrderItem_orderId_idx" ON "ClickatonStoreOrderItem"("orderId");
CREATE INDEX "ClickatonStoreOrderItem_productId_idx" ON "ClickatonStoreOrderItem"("productId");
CREATE INDEX "ClickatonStoreOrderItem_productVariantId_idx" ON "ClickatonStoreOrderItem"("productVariantId");

CREATE TABLE "ClickatonStoreStockHold" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "ClickatonStoreHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonStoreStockHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonStoreStockHold_orderId_status_idx" ON "ClickatonStoreStockHold"("orderId", "status");
CREATE INDEX "ClickatonStoreStockHold_productVariantId_status_idx" ON "ClickatonStoreStockHold"("productVariantId", "status");
CREATE INDEX "ClickatonStoreStockHold_status_expiresAt_idx" ON "ClickatonStoreStockHold"("status", "expiresAt");

ALTER TABLE "ClickatonStoreOrderItem" ADD CONSTRAINT "ClickatonStoreOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ClickatonStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClickatonStoreStockHold" ADD CONSTRAINT "ClickatonStoreStockHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ClickatonStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
