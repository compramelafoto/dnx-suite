-- Add cover crop fields and thumbnail key to Album (IF NOT EXISTS para compatibilidad con baseline)
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "coverCropX" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "coverCropY" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "coverCropZoom" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "coverCropAspect" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "coverThumbnailKey" TEXT;
