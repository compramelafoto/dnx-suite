-- Mosaico del curso, etapa 1: retrato oficial por alumno del padrón y estado de cada curso.
-- Aditiva e idempotente: columnas opcionales y una tabla nueva.

ALTER TABLE "AlbumStudentRosterEntry" ADD COLUMN IF NOT EXISTS "mosaicPhotoId" INTEGER;
ALTER TABLE "AlbumStudentRosterEntry" ADD COLUMN IF NOT EXISTS "mosaicPhotoAspect" DOUBLE PRECISION;
ALTER TABLE "AlbumStudentRosterEntry" ADD COLUMN IF NOT EXISTS "mosaicPhotoCrop" JSONB;
ALTER TABLE "AlbumStudentRosterEntry" ADD COLUMN IF NOT EXISTS "mosaicPhotoSource" TEXT;
ALTER TABLE "AlbumStudentRosterEntry" ADD COLUMN IF NOT EXISTS "mosaicPhotoNeedsReview" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "AlbumStudentRosterEntry"
    ADD CONSTRAINT "AlbumStudentRosterEntry_mosaicPhotoId_fkey"
    FOREIGN KEY ("mosaicPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AlbumCourseMosaic" (
  "id" SERIAL NOT NULL,
  "albumId" INTEGER NOT NULL,
  "courseKey" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  "closedByUserId" INTEGER,
  "staffJson" JSONB,
  "unidentifiedPhotoIdsJson" JSONB,
  "schoolTokenHash" TEXT,
  "schoolTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlbumCourseMosaic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlbumCourseMosaic_schoolTokenHash_key" ON "AlbumCourseMosaic"("schoolTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumCourseMosaic_albumId_courseKey_key" ON "AlbumCourseMosaic"("albumId", "courseKey");
CREATE INDEX IF NOT EXISTS "AlbumCourseMosaic_albumId_idx" ON "AlbumCourseMosaic"("albumId");

DO $$ BEGIN
  ALTER TABLE "AlbumCourseMosaic"
    ADD CONSTRAINT "AlbumCourseMosaic_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
