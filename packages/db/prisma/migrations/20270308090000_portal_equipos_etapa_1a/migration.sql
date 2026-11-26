-- Portal de equipos usados verificados, etapa 1a (diseño 2026-11-25).
-- Sólo agrega: tipos, tablas, columnas, índices y claves foráneas. Las denuncias de CLF pasan a
-- admitir pérdidas (incident) y a no exigir comprobante (invoiceKey/invoiceMime opcionales).

DO $$ BEGIN
  CREATE TYPE "StolenGearIncident" AS ENUM ('THEFT', 'LOST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemKind" AS ENUM ('BODY', 'LENS', 'FLASH', 'TRIPOD', 'BAG', 'FILTER', 'DRONE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemStatus" AS ENUM ('IN_USE', 'FOR_SALE', 'SOLD', 'STOLEN', 'LOST', 'RECOVERED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemSource" AS ENUM ('CLF_SIGHTING', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearItemEventType" AS ENUM ('CREATED', 'CONFIRMED_FROM_CLF', 'UPDATED', 'STATUS_CHANGED', 'REPORTED', 'RECOVERED', 'PROOF_ADDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Denuncias de CLF: robo o pérdida, equipo del portal de origen y comprobante opcional.
ALTER TABLE "StolenGearReport" ADD COLUMN IF NOT EXISTS "incident" "StolenGearIncident" NOT NULL DEFAULT 'THEFT';
ALTER TABLE "StolenGearReport" ADD COLUMN IF NOT EXISTS "gearItemId" INTEGER;
ALTER TABLE "StolenGearReport" ALTER COLUMN "invoiceKey" DROP NOT NULL;
ALTER TABLE "StolenGearReport" ALTER COLUMN "invoiceMime" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "IdentityVerification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "documentHash" TEXT,
    "documentLast3" TEXT,
    "legalName" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reviewedById" INTEGER,
    "reverifyRequiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PhoneVerification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearItem" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "kind" "GearItemKind" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialRaw" TEXT,
    "serialNormalized" TEXT,
    "status" "GearItemStatus" NOT NULL DEFAULT 'IN_USE',
    "source" "GearItemSource" NOT NULL,
    "sightingId" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "purchaseProofKey" TEXT,
    "purchaseProofMime" TEXT,
    "declaredValueArs" INTEGER,
    "declaredValueUsd" INTEGER,
    "photoKeys" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearItemEvent" (
    "id" SERIAL NOT NULL,
    "gearItemId" INTEGER NOT NULL,
    "type" "GearItemEventType" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GearItemEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearSightingDismissal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sightingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GearSightingDismissal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearOwnerSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "policyRenewalDate" TIMESTAMP(3),
    "lastRenewalReminderAt" TIMESTAMP(3),

    CONSTRAINT "GearOwnerSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InsuranceReport" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "totalArs" INTEGER NOT NULL,
    "totalUsd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdentityVerification_userId_key" ON "IdentityVerification"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "IdentityVerification_providerRef_key" ON "IdentityVerification"("providerRef");
CREATE UNIQUE INDEX IF NOT EXISTS "IdentityVerification_documentHash_key" ON "IdentityVerification"("documentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneVerification_userId_key" ON "PhoneVerification"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "GearItem_sightingId_key" ON "GearItem"("sightingId");
CREATE INDEX IF NOT EXISTS "GearItem_ownerId_idx" ON "GearItem"("ownerId");
CREATE INDEX IF NOT EXISTS "GearItem_serialNormalized_idx" ON "GearItem"("serialNormalized");
CREATE UNIQUE INDEX IF NOT EXISTS "GearSightingDismissal_userId_sightingId_key" ON "GearSightingDismissal"("userId", "sightingId");
CREATE UNIQUE INDEX IF NOT EXISTS "GearOwnerSettings_userId_key" ON "GearOwnerSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceReport_code_key" ON "InsuranceReport"("code");
CREATE INDEX IF NOT EXISTS "GearItemEvent_gearItemId_idx" ON "GearItemEvent"("gearItemId");
CREATE INDEX IF NOT EXISTS "StolenGearReport_gearItemId_idx" ON "StolenGearReport"("gearItemId");
CREATE INDEX IF NOT EXISTS "InsuranceReport_ownerId_idx" ON "InsuranceReport"("ownerId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StolenGearReport_gearItemId_fkey') THEN
    ALTER TABLE "StolenGearReport" ADD CONSTRAINT "StolenGearReport_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdentityVerification_userId_fkey') THEN
    ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IdentityVerification_reviewedById_fkey') THEN
    ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhoneVerification_userId_fkey') THEN
    ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearItem_ownerId_fkey') THEN
    ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearItem_sightingId_fkey') THEN
    ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "GearSerialSighting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearItemEvent_gearItemId_fkey') THEN
    ALTER TABLE "GearItemEvent" ADD CONSTRAINT "GearItemEvent_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSightingDismissal_userId_fkey') THEN
    ALTER TABLE "GearSightingDismissal" ADD CONSTRAINT "GearSightingDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearOwnerSettings_userId_fkey') THEN
    ALTER TABLE "GearOwnerSettings" ADD CONSTRAINT "GearOwnerSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceReport_ownerId_fkey') THEN
    ALTER TABLE "InsuranceReport" ADD CONSTRAINT "InsuranceReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
