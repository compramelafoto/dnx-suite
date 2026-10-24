-- Fotos sin fondo para los huecos de plantilla marcados «Quitar el fondo».
-- Aditiva e idempotente: una tabla nueva.

CREATE TABLE IF NOT EXISTS "PhotoCutout" (
  "id" SERIAL NOT NULL,
  "photoId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "key" TEXT,
  "provider" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoCutout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PhotoCutout_photoId_key" ON "PhotoCutout"("photoId");

DO $$ BEGIN
  ALTER TABLE "PhotoCutout"
    ADD CONSTRAINT "PhotoCutout_photoId_fkey"
    FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
