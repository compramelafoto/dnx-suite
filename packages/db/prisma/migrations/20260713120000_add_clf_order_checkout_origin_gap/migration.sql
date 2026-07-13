-- CLF Order checkout gap (staging Neon ep-round-fog)
-- Smoke E2E P0 blocker:
--   POST /api/a/{id}/orders → P2022 Order.origin does not exist
--
-- Schema already has Order.origin / checkoutPaymentSource / buyerName / etc.
-- but no prior migration applied those columns on staging.
--
-- Scope: enums + columns + indexes required for STANDARD_CHECKOUT create/idempotency.
-- Forward-only, additive, idempotent. Do NOT apply to production yet.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "OrderOrigin" AS ENUM ('STANDARD_CHECKOUT', 'PACK_REDEMPTION', 'PREVENTA_PACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CheckoutPaymentSource" AS ENUM ('MERCADO_PAGO', 'PREPAID_PACK', 'SIMULATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderItemLineOrigin" AS ENUM ('STANDARD', 'PACK_INCLUDED', 'EXTRA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Order columns
-- ---------------------------------------------------------------------------
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "origin" "OrderOrigin" NOT NULL DEFAULT 'STANDARD_CHECKOUT';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "checkoutPaymentSource" "CheckoutPaymentSource" NOT NULL DEFAULT 'MERCADO_PAGO';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "redemptionPaymentRefsJson" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "preCompraPaymentRef" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "preventaPackSnapshotJson" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "redemptionOrderId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "redeemsOrderId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizerSchoolId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizerUserId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizerReferralApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyerName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unique 1:1 redemption links (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS "Order_redemptionOrderId_key" ON "Order"("redemptionOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_redeemsOrderId_key" ON "Order"("redeemsOrderId");

CREATE INDEX IF NOT EXISTS "Order_origin_idx" ON "Order"("origin");
CREATE INDEX IF NOT EXISTS "Order_checkoutPaymentSource_idx" ON "Order"("checkoutPaymentSource");
CREATE INDEX IF NOT EXISTS "Order_status_updatedAt_idx" ON "Order"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Order_isTest_idx" ON "Order"("isTest");
CREATE INDEX IF NOT EXISTS "Order_organizerSchoolId_idx" ON "Order"("organizerSchoolId");
CREATE INDEX IF NOT EXISTS "Order_organizerReferralApplied_idx" ON "Order"("organizerReferralApplied");

-- ---------------------------------------------------------------------------
-- OrderItem columns (preventa line metadata; safe defaults for digital checkout)
-- ---------------------------------------------------------------------------
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "lineOrigin" "OrderItemLineOrigin" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "entitlementId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "benefitStableKey" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "packSlotIndex" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "OrderItem_lineOrigin_idx" ON "OrderItem"("lineOrigin");
CREATE INDEX IF NOT EXISTS "OrderItem_entitlementId_idx" ON "OrderItem"("entitlementId");
