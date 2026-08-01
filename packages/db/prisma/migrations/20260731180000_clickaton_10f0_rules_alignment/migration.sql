-- Clickatón 10F.0 — rules alignment (additive)

-- Edition status
ALTER TYPE "ClickatonEditionStatus" ADD VALUE IF NOT EXISTS 'REPROGRAMMED';

-- Registration status
ALTER TYPE "ClickatonRegistrationStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED_TO_NEXT_EDITION';
ALTER TYPE "ClickatonRegistrationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "ClickatonRegistrationStatus" ADD VALUE IF NOT EXISTS 'REFUND_REQUESTED';

-- Edition rulesConfig
ALTER TABLE "ClickatonEdition" ADD COLUMN IF NOT EXISTS "rulesConfig" JSONB;

-- Registration consent / transfer / competitive fields
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "promotionalLicenseAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "identifiablePersonsDeclaredAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "identifiablePersonsPolicyVersion" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "registrationAuditIp" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "registrationAuditUserAgent" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultResponsibleName" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultResponsibleContact" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultAuthorizationAcceptedAt" TIMESTAMP(3);
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "accompanimentConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "minorLegalFieldsStatus" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferredFromRegistrationId" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferredToRegistrationId" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "competitiveStatus" TEXT;
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "competitiveValidPromptCount" INTEGER;

-- Entitlement enums
DO $$ BEGIN
  CREATE TYPE "ClickatonEntitlementType" AS ENUM ('RETURNING_PARTICIPANT_EARLY_PRICE', 'ANNUAL_PASS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ClickatonEntitlementStatus" AS ENUM ('ACTIVE', 'USED', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClickatonUserEntitlement" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "type" "ClickatonEntitlementType" NOT NULL,
  "status" "ClickatonEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceEditionId" TEXT,
  "targetEditionId" TEXT,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "purchasedAt" TIMESTAMP(3),
  "purchasePriceMinor" INTEGER,
  "startingEditionId" TEXT,
  "totalCredits" INTEGER,
  "consumedCredits" INTEGER NOT NULL DEFAULT 0,
  "cycleKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonUserEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClickatonEntitlementConsumption" (
  "id" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "ClickatonEntitlementConsumption_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE TYPE "ClickatonPrizeBundleStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'ASSIGNED', 'DELIVERED', 'REPLACED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClickatonPrizeBundle" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sponsor" TEXT,
  "itemsJson" JSONB,
  "referentialValueMinor" INTEGER,
  "status" "ClickatonPrizeBundleStatus" NOT NULL DEFAULT 'DRAFT',
  "replacementNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonPrizeBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClickatonPrizeAssignment" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "winnerRegistrationId" TEXT,
  "winnerEntryId" TEXT,
  "promptId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveryDueAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "replacedAt" TIMESTAMP(3),
  "auditJson" JSONB,
  CONSTRAINT "ClickatonPrizeAssignment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE TYPE "ClickatonSocialVotingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED', 'INVALIDATED', 'RESOLVED', 'MANUAL_REVIEW_REQUIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClickatonSocialVotingRound" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "status" "ClickatonSocialVotingStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "votingClosesAt" TIMESTAMP(3),
  "carouselMediaIds" JSONB,
  "likeCountsJson" JSONB,
  "winnerEntryId" TEXT,
  "fraudFlagsJson" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonSocialVotingRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClickatonSocialVoteFraudFlag" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "entryId" TEXT,
  "reason" TEXT NOT NULL,
  "invalidated" BOOLEAN NOT NULL DEFAULT false,
  "overrideNote" TEXT,
  "actorUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonSocialVoteFraudFlag_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE TYPE "ClickatonRoyaltyLedgerStatus" AS ENUM ('PENDING', 'AVAILABLE', 'WITHDRAWAL_REQUESTED', 'PAID', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ClickatonPhotographerRoyaltyLedger" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "photographerUserId" INTEGER NOT NULL,
  "productKind" TEXT NOT NULL,
  "orderId" TEXT,
  "productId" TEXT,
  "entryId" TEXT,
  "workTitle" TEXT,
  "productPaidMinor" INTEGER NOT NULL,
  "shippingPaidMinor" INTEGER NOT NULL DEFAULT 0,
  "royaltyBaseMinor" INTEGER NOT NULL,
  "royaltyMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "status" "ClickatonRoyaltyLedgerStatus" NOT NULL DEFAULT 'PENDING',
  "soldAt" TIMESTAMP(3) NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL,
  "withdrawalRequestedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "auditJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonPhotographerRoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- FKs / indexes (idempotent-ish)
DO $$ BEGIN
  ALTER TABLE "ClickatonUserEntitlement" ADD CONSTRAINT "ClickatonUserEntitlement_sourceEditionId_fkey" FOREIGN KEY ("sourceEditionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonUserEntitlement" ADD CONSTRAINT "ClickatonUserEntitlement_targetEditionId_fkey" FOREIGN KEY ("targetEditionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonEntitlementConsumption" ADD CONSTRAINT "ClickatonEntitlementConsumption_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "ClickatonUserEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrizeBundle" ADD CONSTRAINT "ClickatonPrizeBundle_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPrizeAssignment" ADD CONSTRAINT "ClickatonPrizeAssignment_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ClickatonPrizeBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonSocialVotingRound" ADD CONSTRAINT "ClickatonSocialVotingRound_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonSocialVoteFraudFlag" ADD CONSTRAINT "ClickatonSocialVoteFraudFlag_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ClickatonSocialVotingRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ClickatonPhotographerRoyaltyLedger" ADD CONSTRAINT "ClickatonPhotographerRoyaltyLedger_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEntitlementConsumption_entitlementId_idempotencyKey_key" ON "ClickatonEntitlementConsumption"("entitlementId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ClickatonUserEntitlement_userId_type_status_idx" ON "ClickatonUserEntitlement"("userId", "type", "status");
CREATE INDEX IF NOT EXISTS "ClickatonUserEntitlement_targetEditionId_status_idx" ON "ClickatonUserEntitlement"("targetEditionId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonPrizeBundle_editionId_slot_key" ON "ClickatonPrizeBundle"("editionId", "slot");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonPrizeAssignment_bundleId_key" ON "ClickatonPrizeAssignment"("bundleId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonSocialVotingRound_editionId_promptId_key" ON "ClickatonSocialVotingRound"("editionId", "promptId");
CREATE INDEX IF NOT EXISTS "ClickatonPhotographerRoyaltyLedger_photographerUserId_status_idx" ON "ClickatonPhotographerRoyaltyLedger"("photographerUserId", "status");
