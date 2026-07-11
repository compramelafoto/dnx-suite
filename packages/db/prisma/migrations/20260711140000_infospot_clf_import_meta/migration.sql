-- AlterTable Info Spot only (no CLF writes)
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "clfSourceEnv" TEXT;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "clfImportedAt" TIMESTAMP(3);
