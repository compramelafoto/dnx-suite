-- «Todas mis fotos» que se van sumando: opción en el pack, selfie guardada del comprador y fotos
-- sumadas al pedido después de pagarlo. Sólo agrega; no toca datos existentes.
ALTER TABLE "AlbumPack" ADD COLUMN IF NOT EXISTS "keepsAddingPhotos" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "GrowingPackFace" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "albumPackId" TEXT NOT NULL,
    "selectionSessionId" TEXT NOT NULL,
    "orderId" INTEGER,
    "faceId" TEXT,
    "selfieKey" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "panelSeenAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "biometricDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowingPackFace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrowingPackFace_selectionSessionId_key" ON "GrowingPackFace"("selectionSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "GrowingPackFace_orderId_key" ON "GrowingPackFace"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "GrowingPackFace_faceId_key" ON "GrowingPackFace"("faceId");
CREATE UNIQUE INDEX IF NOT EXISTS "GrowingPackFace_selfieKey_key" ON "GrowingPackFace"("selfieKey");
CREATE INDEX IF NOT EXISTS "GrowingPackFace_albumId_idx" ON "GrowingPackFace"("albumId");

CREATE TABLE IF NOT EXISTS "OrderAddedPhoto" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "similarity" DOUBLE PRECISION,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    "removedByClientAt" TIMESTAMP(3),
    CONSTRAINT "OrderAddedPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderAddedPhoto_orderId_photoId_key" ON "OrderAddedPhoto"("orderId", "photoId");
CREATE INDEX IF NOT EXISTS "OrderAddedPhoto_orderId_idx" ON "OrderAddedPhoto"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAddedPhoto_photoId_idx" ON "OrderAddedPhoto"("photoId");

DO $$ BEGIN
  ALTER TABLE "GrowingPackFace" ADD CONSTRAINT "GrowingPackFace_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GrowingPackFace" ADD CONSTRAINT "GrowingPackFace_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderAddedPhoto" ADD CONSTRAINT "OrderAddedPhoto_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OrderAddedPhoto" ADD CONSTRAINT "OrderAddedPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
