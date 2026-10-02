-- Cupones con comisión de Clickatón: fotógrafos afiliados y el libro de
-- comisiones (una por inscripción que usó un código con dueño).
-- Sólo agrega; no toca tablas ni datos existentes. Se puede correr más de una vez.

DO $$ BEGIN
    CREATE TYPE "ClickatonAffiliateCommissionMode" AS ENUM ('SPLIT', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ClickatonAffiliateCommissionStatus" AS ENUM ('PENDING', 'PAID_BY_SPLIT', 'OWED', 'PAID_OUT', 'REVERSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClickatonAffiliate" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mpSellerEmail" TEXT NOT NULL,
    "paymentRecipientId" TEXT,
    "consentReceiverId" TEXT,
    "consentStatus" TEXT NOT NULL DEFAULT 'NONE',
    "consentInviteUrl" TEXT,
    "consentCheckedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonAffiliate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAffiliate_userId_key" ON "ClickatonAffiliate"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAffiliate_mpSellerEmail_key" ON "ClickatonAffiliate"("mpSellerEmail");

CREATE TABLE IF NOT EXISTS "ClickatonAffiliateCommission" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "promotionCodeSnapshot" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "mpFeeBps" INTEGER NOT NULL,
    "mpFeeShareAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "mode" "ClickatonAffiliateCommissionMode",
    "status" "ClickatonAffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "providerOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidOutAt" TIMESTAMP(3),
    "paidOutByUserId" INTEGER,
    "paidOutReference" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonAffiliateCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAffiliateCommission_registrationId_key" ON "ClickatonAffiliateCommission"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonAffiliateCommission_affiliateId_status_idx" ON "ClickatonAffiliateCommission"("affiliateId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonAffiliateCommission_editionId_status_idx" ON "ClickatonAffiliateCommission"("editionId", "status");

DO $$ BEGIN
    ALTER TABLE "ClickatonAffiliateCommission" ADD CONSTRAINT "ClickatonAffiliateCommission_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ClickatonAffiliateCommission" ADD CONSTRAINT "ClickatonAffiliateCommission_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ClickatonAffiliateCommission" ADD CONSTRAINT "ClickatonAffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "ClickatonAffiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
