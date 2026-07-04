-- CreateEnum: estado de estrategia de upsell
DO $$ BEGIN
  CREATE TYPE "UpsellStrategyStatus" AS ENUM ('DRAFT', 'QA', 'BETA', 'APPROVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: configuración de ventas del fotógrafo
CREATE TABLE IF NOT EXISTS "PhotographerSalesSettings" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "digitalEnabled" BOOLEAN NOT NULL DEFAULT true,
  "printsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "retouchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "expressEnabled" BOOLEAN NOT NULL DEFAULT false,
  "storageExtendEnabled" BOOLEAN NOT NULL DEFAULT false,
  "printsPriceListJson" JSONB,
  "printsFulfillmentJson" JSONB,
  "retouchPricingJson" JSONB,
  "expressPricingJson" JSONB,
  "storageExtendPricingJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PhotographerSalesSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PhotographerSalesSettings_userId_key" ON "PhotographerSalesSettings"("userId");

ALTER TABLE "PhotographerSalesSettings" DROP CONSTRAINT IF EXISTS "PhotographerSalesSettings_userId_fkey";
ALTER TABLE "PhotographerSalesSettings" ADD CONSTRAINT "PhotographerSalesSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: configuración de ventas por álbum
CREATE TABLE IF NOT EXISTS "AlbumSalesSettings" (
  "id" SERIAL NOT NULL,
  "albumId" INTEGER NOT NULL,
  "inheritFromPhotographer" BOOLEAN NOT NULL DEFAULT true,
  "allowedCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "disabledCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlbumSalesSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlbumSalesSettings_albumId_key" ON "AlbumSalesSettings"("albumId");

ALTER TABLE "AlbumSalesSettings" DROP CONSTRAINT IF EXISTS "AlbumSalesSettings_albumId_fkey";
ALTER TABLE "AlbumSalesSettings" ADD CONSTRAINT "AlbumSalesSettings_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: estrategias de upsell
CREATE TABLE IF NOT EXISTS "UpsellStrategy" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "UpsellStrategyStatus" NOT NULL DEFAULT 'DRAFT',
  "enabledGlobally" BOOLEAN NOT NULL DEFAULT false,
  "requiresCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requiresConfigKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rulesJson" JSONB,
  "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
  "rolloutAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UpsellStrategy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UpsellStrategy_slug_key" ON "UpsellStrategy"("slug");

-- CreateTable: configuración por usuario de estrategias
CREATE TABLE IF NOT EXISTS "UserUpsellConfig" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "strategyId" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserUpsellConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserUpsellConfig_userId_strategyId_key" ON "UserUpsellConfig"("userId", "strategyId");
CREATE INDEX IF NOT EXISTS "UserUpsellConfig_userId_idx" ON "UserUpsellConfig"("userId");
CREATE INDEX IF NOT EXISTS "UserUpsellConfig_strategyId_idx" ON "UserUpsellConfig"("strategyId");

ALTER TABLE "UserUpsellConfig" DROP CONSTRAINT IF EXISTS "UserUpsellConfig_userId_fkey";
ALTER TABLE "UserUpsellConfig" ADD CONSTRAINT "UserUpsellConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserUpsellConfig" DROP CONSTRAINT IF EXISTS "UserUpsellConfig_strategyId_fkey";
ALTER TABLE "UserUpsellConfig" ADD CONSTRAINT "UserUpsellConfig_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "UpsellStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
