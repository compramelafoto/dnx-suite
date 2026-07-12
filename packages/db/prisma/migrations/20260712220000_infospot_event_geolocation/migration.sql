-- Info Spot: georreferenciación completa de eventos.
-- No altera estados editoriales ni migraciones previas.

CREATE TYPE "InfoSpotGeocodingStatus" AS ENUM (
  'PENDING',
  'GEOCODED',
  'CONFIRMED',
  'FAILED',
  'NEEDS_REVIEW'
);

CREATE TYPE "InfoSpotLocationPrecision" AS ENUM (
  'COUNTRY',
  'PROVINCE',
  'CITY',
  'NEIGHBORHOOD',
  'VENUE',
  'ADDRESS',
  'COORDINATE'
);

CREATE TYPE "InfoSpotLocationVisibility" AS ENUM (
  'EXACT',
  'APPROXIMATE',
  'CITY_ONLY',
  'HIDDEN'
);

ALTER TABLE "InfoSpotEvent"
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "countryCode" TEXT DEFAULT 'AR',
  ADD COLUMN "countryName" TEXT DEFAULT 'Argentina',
  ADD COLUMN "geohash" TEXT,
  ADD COLUMN "locationPrecision" "InfoSpotLocationPrecision",
  ADD COLUMN "geocodingProvider" TEXT,
  ADD COLUMN "geocodingPlaceId" TEXT,
  ADD COLUMN "geocodingStatus" "InfoSpotGeocodingStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "geocodedAt" TIMESTAMP(3),
  ADD COLUMN "locationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "locationConfirmedByUserId" INTEGER,
  ADD COLUMN "locationVisibility" "InfoSpotLocationVisibility" NOT NULL DEFAULT 'CITY_ONLY',
  ADD COLUMN "locationOverridden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "coordinatesOverridden" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: eventos con coords usables quedan GEOCODED (no CONFIRMED).
UPDATE "InfoSpotEvent"
SET
  "geocodingStatus" = 'GEOCODED',
  "geocodedAt" = COALESCE("updatedAt", NOW()),
  "locationPrecision" = 'COORDINATE'
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND ("latitude" <> 0 OR "longitude" <> 0);

-- Sin coords o 0,0 → NEEDS_REVIEW si ya tienen ciudad (típico import/intake).
UPDATE "InfoSpotEvent"
SET "geocodingStatus" = 'NEEDS_REVIEW'
WHERE (
  "latitude" IS NULL
  OR "longitude" IS NULL
  OR ("latitude" = 0 AND "longitude" = 0)
)
AND TRIM("city") <> '';

CREATE INDEX "InfoSpotEvent_geohash_idx" ON "InfoSpotEvent"("geohash");
CREATE INDEX "InfoSpotEvent_geocodingStatus_idx" ON "InfoSpotEvent"("geocodingStatus");
CREATE INDEX "InfoSpotEvent_locationConfirmedAt_idx" ON "InfoSpotEvent"("locationConfirmedAt");

COMMENT ON COLUMN "InfoSpotEvent"."venueName" IS
  'Nombre del lugar (equivalente a locationName en CLF Event).';
COMMENT ON COLUMN "InfoSpotEvent"."locationOverridden" IS
  'Si true, sync inbound no sobrescribe campos textuales de ubicación.';
COMMENT ON COLUMN "InfoSpotEvent"."coordinatesOverridden" IS
  'Si true, sync inbound no sobrescribe lat/lng/geohash.';
COMMENT ON COLUMN "InfoSpotEvent"."geocodingStatus" IS
  'Estado operativo de geocodificación; independiente del status editorial.';
