-- Regalo de inscripción de Clickatón.
-- Se aplica a mano en las 5 bases Neon antes de publicar el código.

-- Estado nuevo de inscripción: regalo pagado sin activar.
-- ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción que lo agrega;
-- acá sólo se agrega, así que es seguro.
ALTER TYPE "ClickatonRegistrationStatus" ADD VALUE IF NOT EXISTS 'GIFT_AWAITING_REDEMPTION';

-- Estado del voucher de regalo.
DO $$ BEGIN
  CREATE TYPE "ClickatonGiftVoucherStatus" AS ENUM (
    'PENDING_PAYMENT', 'ACTIVE', 'REDEEMED', 'CARRIED_OVER', 'CANCELLED', 'REFUNDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "isGift" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClickatonEdition"
  ADD COLUMN IF NOT EXISTS "giftVouchersEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ClickatonGiftVoucher" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "ClickatonGiftVoucherStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "buyerUserId" INTEGER,
  "buyerFirstName" TEXT NOT NULL,
  "buyerLastName" TEXT NOT NULL,
  "buyerEmail" TEXT NOT NULL,
  "buyerPhone" TEXT,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "giftMessage" TEXT,
  "paidAt" TIMESTAMP(3),
  "redeemableUntil" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "carriedOverToEditionId" TEXT,
  "carriedOverAt" TIMESTAMP(3),
  "reissueCount" INTEGER NOT NULL DEFAULT 0,
  "recipientEmailSentAt" TIMESTAMP(3),
  "recipientEmailCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonGiftVoucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonGiftVoucher_code_key"
  ON "ClickatonGiftVoucher"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonGiftVoucher_registrationId_key"
  ON "ClickatonGiftVoucher"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_editionId_status_idx"
  ON "ClickatonGiftVoucher"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_buyerEmail_idx"
  ON "ClickatonGiftVoucher"("buyerEmail");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_recipientEmail_idx"
  ON "ClickatonGiftVoucher"("recipientEmail");
CREATE INDEX IF NOT EXISTS "ClickatonGiftVoucher_status_redeemableUntil_idx"
  ON "ClickatonGiftVoucher"("status", "redeemableUntil");

DO $$ BEGIN
  ALTER TABLE "ClickatonGiftVoucher"
    ADD CONSTRAINT "ClickatonGiftVoucher_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonGiftVoucher"
    ADD CONSTRAINT "ClickatonGiftVoucher_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonGiftVoucher"
    ADD CONSTRAINT "ClickatonGiftVoucher_carriedOverToEditionId_fkey"
    FOREIGN KEY ("carriedOverToEditionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
