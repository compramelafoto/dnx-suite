-- Pack 4 / annual pass entitlements (idempotent)
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
  ALTER TABLE "ClickatonUserEntitlement" ADD CONSTRAINT "ClickatonUserEntitlement_sourceEditionId_fkey" FOREIGN KEY ("sourceEditionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonUserEntitlement" ADD CONSTRAINT "ClickatonUserEntitlement_targetEditionId_fkey" FOREIGN KEY ("targetEditionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonEntitlementConsumption" ADD CONSTRAINT "ClickatonEntitlementConsumption_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "ClickatonUserEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEntitlementConsumption_entitlementId_idempotencyKey_key" ON "ClickatonEntitlementConsumption"("entitlementId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "ClickatonUserEntitlement_userId_type_status_idx" ON "ClickatonUserEntitlement"("userId", "type", "status");
CREATE INDEX IF NOT EXISTS "ClickatonUserEntitlement_targetEditionId_status_idx" ON "ClickatonUserEntitlement"("targetEditionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonUserEntitlement_sourceEditionId_idx" ON "ClickatonUserEntitlement"("sourceEditionId");
CREATE INDEX IF NOT EXISTS "ClickatonEntitlementConsumption_editionId_eventType_idx" ON "ClickatonEntitlementConsumption"("editionId", "eventType");
