-- DNX Promotions (Etapa 3 Clickatón) — additive only.
-- Paquete de dominio: @repo/promotions

CREATE TYPE "DnxPromotionDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "DnxPromotionRedemptionStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'RELEASED');

CREATE TABLE "DnxPromotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DnxPromotionDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minimumPurchaseAmount" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalUsageLimit" INTEGER,
    "perUserUsageLimit" INTEGER DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "platform" TEXT NOT NULL,
    "editionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPromotion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPromotion_code_key" ON "DnxPromotion"("code");
CREATE INDEX "DnxPromotion_platform_isActive_idx" ON "DnxPromotion"("platform", "isActive");
CREATE INDEX "DnxPromotion_platform_editionId_idx" ON "DnxPromotion"("platform", "editionId");
CREATE INDEX "DnxPromotion_startsAt_endsAt_idx" ON "DnxPromotion"("startsAt", "endsAt");

CREATE TABLE "DnxPromotionRedemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" INTEGER,
    "registrationId" TEXT,
    "orderId" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "finalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "platform" TEXT NOT NULL,
    "editionId" TEXT,
    "status" "DnxPromotionRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "idempotencyKey" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPromotionRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPromotionRedemption_idempotencyKey_key" ON "DnxPromotionRedemption"("idempotencyKey");
CREATE INDEX "DnxPromotionRedemption_promotionId_status_idx" ON "DnxPromotionRedemption"("promotionId", "status");
CREATE INDEX "DnxPromotionRedemption_userId_promotionId_status_idx" ON "DnxPromotionRedemption"("userId", "promotionId", "status");
CREATE INDEX "DnxPromotionRedemption_registrationId_idx" ON "DnxPromotionRedemption"("registrationId");
CREATE INDEX "DnxPromotionRedemption_orderId_idx" ON "DnxPromotionRedemption"("orderId");
CREATE INDEX "DnxPromotionRedemption_platform_editionId_idx" ON "DnxPromotionRedemption"("platform", "editionId");

ALTER TABLE "DnxPromotionRedemption"
  ADD CONSTRAINT "DnxPromotionRedemption_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "DnxPromotion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN "promotionId" TEXT,
  ADD COLUMN "promotionCodeSnapshot" TEXT;
