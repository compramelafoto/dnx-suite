-- Portal de equipos usados verificados, etapa 1b-2 (ventas, calificaciones, favoritos, alertas, pedidos «Busco», denuncias y bloqueos).
-- Sólo agrega: tipos, tablas, una columna con valor por defecto, índices y claves foráneas. No toca nada existente.

DO $$ BEGIN
  CREATE TYPE "GearSaleStatus" AS ENUM ('PENDING_BUYER', 'CONFIRMED', 'DECLINED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseRequestStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseRequestResponse" AS ENUM ('INTERESTED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "GearOwnerSettings" ADD COLUMN IF NOT EXISTS "purchaseRequestOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "GearSale" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "gearItemId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "status" "GearSaleStatus" NOT NULL DEFAULT 'PENDING_BUYER',
    "priceArs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

CONSTRAINT "GearSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearSaleRating" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "raterId" INTEGER NOT NULL,
    "ratedId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearSaleRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearListingFavorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearListingFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearSearchAlert" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" "GearItemKind",
    "make" TEXT,
    "mount" TEXT,
    "maxPriceArs" INTEGER,
    "province" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearSearchAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GearSearchAlertHit" (
    "id" SERIAL NOT NULL,
    "alertId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GearSearchAlertHit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "kind" "GearItemKind" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "maxPriceArs" INTEGER,
    "minCondition" "GearListingCondition",
    "province" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseRequestNotice" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "gearItemId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" "PurchaseRequestResponse",
    "respondedAt" TIMESTAMP(3),
    "listingId" INTEGER,

CONSTRAINT "PurchaseRequestNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortalUserReport" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reportedId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,

CONSTRAINT "PortalUserReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PortalAccountBlock" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),

CONSTRAINT "PortalAccountBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GearSale_listingId_key" ON "GearSale"("listingId");

CREATE INDEX IF NOT EXISTS "GearSale_buyerId_status_idx" ON "GearSale"("buyerId", "status");

CREATE INDEX IF NOT EXISTS "GearSale_sellerId_idx" ON "GearSale"("sellerId");

CREATE INDEX IF NOT EXISTS "GearSale_status_expiresAt_idx" ON "GearSale"("status", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GearSaleRating_saleId_raterId_key" ON "GearSaleRating"("saleId", "raterId");

CREATE INDEX IF NOT EXISTS "GearSaleRating_ratedId_idx" ON "GearSaleRating"("ratedId");

CREATE UNIQUE INDEX IF NOT EXISTS "GearListingFavorite_userId_listingId_key" ON "GearListingFavorite"("userId", "listingId");

CREATE INDEX IF NOT EXISTS "GearListingFavorite_listingId_idx" ON "GearListingFavorite"("listingId");

CREATE INDEX IF NOT EXISTS "GearSearchAlert_userId_active_idx" ON "GearSearchAlert"("userId", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "GearSearchAlertHit_alertId_listingId_key" ON "GearSearchAlertHit"("alertId", "listingId");

CREATE INDEX IF NOT EXISTS "PurchaseRequest_buyerId_status_idx" ON "PurchaseRequest"("buyerId", "status");

CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_modelKey_idx" ON "PurchaseRequest"("status", "modelKey");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequestNotice_requestId_ownerId_key" ON "PurchaseRequestNotice"("requestId", "ownerId");

CREATE INDEX IF NOT EXISTS "PurchaseRequestNotice_ownerId_sentAt_idx" ON "PurchaseRequestNotice"("ownerId", "sentAt");

CREATE INDEX IF NOT EXISTS "PurchaseRequestNotice_gearItemId_idx" ON "PurchaseRequestNotice"("gearItemId");

CREATE UNIQUE INDEX IF NOT EXISTS "PortalUserReport_reporterId_reportedId_key" ON "PortalUserReport"("reporterId", "reportedId");

CREATE INDEX IF NOT EXISTS "PortalUserReport_resolvedAt_idx" ON "PortalUserReport"("resolvedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PortalAccountBlock_userId_key" ON "PortalAccountBlock"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSale_listingId_fkey') THEN
    ALTER TABLE "GearSale" ADD CONSTRAINT "GearSale_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSale_gearItemId_fkey') THEN
    ALTER TABLE "GearSale" ADD CONSTRAINT "GearSale_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSale_sellerId_fkey') THEN
    ALTER TABLE "GearSale" ADD CONSTRAINT "GearSale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSale_buyerId_fkey') THEN
    ALTER TABLE "GearSale" ADD CONSTRAINT "GearSale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSaleRating_saleId_fkey') THEN
    ALTER TABLE "GearSaleRating" ADD CONSTRAINT "GearSaleRating_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "GearSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSaleRating_raterId_fkey') THEN
    ALTER TABLE "GearSaleRating" ADD CONSTRAINT "GearSaleRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSaleRating_ratedId_fkey') THEN
    ALTER TABLE "GearSaleRating" ADD CONSTRAINT "GearSaleRating_ratedId_fkey" FOREIGN KEY ("ratedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingFavorite_userId_fkey') THEN
    ALTER TABLE "GearListingFavorite" ADD CONSTRAINT "GearListingFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearListingFavorite_listingId_fkey') THEN
    ALTER TABLE "GearListingFavorite" ADD CONSTRAINT "GearListingFavorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSearchAlert_userId_fkey') THEN
    ALTER TABLE "GearSearchAlert" ADD CONSTRAINT "GearSearchAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSearchAlertHit_alertId_fkey') THEN
    ALTER TABLE "GearSearchAlertHit" ADD CONSTRAINT "GearSearchAlertHit_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "GearSearchAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GearSearchAlertHit_listingId_fkey') THEN
    ALTER TABLE "GearSearchAlertHit" ADD CONSTRAINT "GearSearchAlertHit_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequest_buyerId_fkey') THEN
    ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequestNotice_requestId_fkey') THEN
    ALTER TABLE "PurchaseRequestNotice" ADD CONSTRAINT "PurchaseRequestNotice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequestNotice_ownerId_fkey') THEN
    ALTER TABLE "PurchaseRequestNotice" ADD CONSTRAINT "PurchaseRequestNotice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseRequestNotice_gearItemId_fkey') THEN
    ALTER TABLE "PurchaseRequestNotice" ADD CONSTRAINT "PurchaseRequestNotice_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalUserReport_reporterId_fkey') THEN
    ALTER TABLE "PortalUserReport" ADD CONSTRAINT "PortalUserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalUserReport_reportedId_fkey') THEN
    ALTER TABLE "PortalUserReport" ADD CONSTRAINT "PortalUserReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalAccountBlock_userId_fkey') THEN
    ALTER TABLE "PortalAccountBlock" ADD CONSTRAINT "PortalAccountBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
