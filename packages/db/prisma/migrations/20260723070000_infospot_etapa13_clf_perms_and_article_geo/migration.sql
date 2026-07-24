-- Etapa 13: permiso CLF por miembro + georreferenciación editorial en notas.
-- NO aplicar a producción desde este agente. Revisar y aplicar en staging/local.

CREATE TYPE "InfoSpotGeographicScope" AS ENUM (
  'LOCAL',
  'PROVINCIAL',
  'NATIONAL',
  'INTERNATIONAL',
  'UNSPECIFIED'
);

ALTER TABLE "InfoSpotUserRole"
  ADD COLUMN IF NOT EXISTS "canProvisionClfPhotographerCall" BOOLEAN NOT NULL DEFAULT false;

-- Directores: habilitar por defecto (el guard también fuerza true para Director).
UPDATE "InfoSpotUserRole"
SET "canProvisionClfPhotographerCall" = true
WHERE "role" = 'INFOSPOT_DIRECTOR';

CREATE INDEX IF NOT EXISTS "InfoSpotUserRole_canProvisionClfPhotographerCall_status_idx"
  ON "InfoSpotUserRole"("canProvisionClfPhotographerCall", "status");

ALTER TABLE "InfoSpotArticle"
  ADD COLUMN IF NOT EXISTS "geographicScope" "InfoSpotGeographicScope",
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "countryName" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "placeName" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "formattedAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "geohash" TEXT;

CREATE INDEX IF NOT EXISTS "InfoSpotArticle_geographicScope_status_idx"
  ON "InfoSpotArticle"("geographicScope", "status");

CREATE INDEX IF NOT EXISTS "InfoSpotArticle_countryCode_province_city_idx"
  ON "InfoSpotArticle"("countryCode", "province", "city");

CREATE INDEX IF NOT EXISTS "InfoSpotArticle_geohash_idx"
  ON "InfoSpotArticle"("geohash");
