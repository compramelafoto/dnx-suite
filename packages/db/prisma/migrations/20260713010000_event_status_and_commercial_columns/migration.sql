-- Alinea columnas Event requeridas por el schema Prisma en entornos staging rezagados.
-- Idempotente: no falla si ya existen (p.ej. DB CLF completa).
-- NO implica migrar producción en esta etapa; se aplica solo a staging preview.

DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventPhotoPricingMode" AS ENUM (
    'PHOTOGRAPHER_DECIDES',
    'ORGANIZER_FIXED',
    'ORGANIZER_MINIMUM'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "photographerTerms" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "uploadsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizerCommissionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizerCommissionPercentage" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizerCommissionUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizerCommissionUpdatedById" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "photoPricingMode" "EventPhotoPricingMode" NOT NULL DEFAULT 'PHOTOGRAPHER_DECIDES';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "fixedPhotoPrice" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "minimumPhotoPrice" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "photoPricingUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "photoPricingUpdatedById" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "nearbyPhotographersAutoNotifiedAt" TIMESTAMP(3);
