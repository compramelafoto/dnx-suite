-- Portal de equipos usados verificados, etapa 1b-1 (publicaciones, contactos y consultas de serie).
-- Sólo agrega: tipos, tablas, índices y claves foráneas. No toca nada existente.


DO $$ BEGIN
  CREATE TYPE "GearListingStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'WITH_DETAILS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GearListingUsageSeal" AS ENUM ('USAGE_VERIFIED', 'PROOF_PHOTO', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GearListing" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "gearItemId" INTEGER NOT NULL,
    "status" "GearListingStatus" NOT NULL DEFAULT 'DRAFT',
    "kind" "GearItemKind" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "mount" TEXT,
    "priceArs" INTEGER NOT NULL,
    "priceUsdRef" INTEGER,
    "condition" "GearListingCondition" NOT NULL,
    "description" TEXT,
    "accessories" TEXT,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "serialPhotoKey" TEXT,
    "declaredFirstOwner" BOOLEAN NOT NULL DEFAULT false,
    "includesCharger" BOOLEAN NOT NULL DEFAULT false,
    "batteriesCount" INTEGER,
    "includesManual" BOOLEAN NOT NULL DEFAULT false,
    "includesBox" BOOLEAN NOT NULL DEFAULT false,
    "usageSeal" "GearListingUsageSeal" NOT NULL DEFAULT 'NONE',
    "usageSince" TIMESTAMP(3),
    "usagePhotosCount" INTEGER,
    "socialConsentAt" TIMESTAMP(3) NOT NULL,
    "reviewNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "GearListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearListingView" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "GearListingView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearListingContact" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearListingContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearListingFlag" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

CONSTRAINT "GearListingFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearSerialLookup" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "serialNormalized" TEXT NOT NULL,
    "matchedReportId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearSerialLookup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearListing_status_kind_idx" ON "GearListing"("status", "kind");

CREATE INDEX IF NOT EXISTS "GearListing_sellerId_idx" ON "GearListing"("sellerId");

CREATE INDEX IF NOT EXISTS "GearListing_gearItemId_idx" ON "GearListing"("gearItemId");

CREATE UNIQUE INDEX IF NOT EXISTS "GearListingView_listingId_userId_key" ON "GearListingView"("listingId", "userId");

CREATE INDEX IF NOT EXISTS "GearListingContact_buyerId_createdAt_idx" ON "GearListingContact"("buyerId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GearListingContact_listingId_buyerId_key" ON "GearListingContact"("listingId", "buyerId");

CREATE UNIQUE INDEX IF NOT EXISTS "GearListingFlag_listingId_reporterId_key" ON "GearListingFlag"("listingId", "reporterId");

CREATE INDEX IF NOT EXISTS "GearSerialLookup_userId_createdAt_idx" ON "GearSerialLookup"("userId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListing_sellerId_fkey') THEN
    ALTER TABLE "GearListing" ADD CONSTRAINT "GearListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListing_gearItemId_fkey') THEN
    ALTER TABLE "GearListing" ADD CONSTRAINT "GearListing_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingView_listingId_fkey') THEN
    ALTER TABLE "GearListingView" ADD CONSTRAINT "GearListingView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingView_userId_fkey') THEN
    ALTER TABLE "GearListingView" ADD CONSTRAINT "GearListingView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingContact_listingId_fkey') THEN
    ALTER TABLE "GearListingContact" ADD CONSTRAINT "GearListingContact_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingContact_buyerId_fkey') THEN
    ALTER TABLE "GearListingContact" ADD CONSTRAINT "GearListingContact_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingFlag_listingId_fkey') THEN
    ALTER TABLE "GearListingFlag" ADD CONSTRAINT "GearListingFlag_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingFlag_reporterId_fkey') THEN
    ALTER TABLE "GearListingFlag" ADD CONSTRAINT "GearListingFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSerialLookup_userId_fkey') THEN
    ALTER TABLE "GearSerialLookup" ADD CONSTRAINT "GearSerialLookup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
