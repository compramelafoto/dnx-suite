-- PASO 19.1 — Política editorial explícita por miembro (compatible con canPublish).

CREATE TYPE "InfoSpotPublicationPolicy" AS ENUM ('DIRECT_PUBLISH', 'REQUIRES_APPROVAL');

ALTER TABLE "InfoSpotUserRole"
  ADD COLUMN IF NOT EXISTS "publicationPolicy" "InfoSpotPublicationPolicy" NOT NULL DEFAULT 'DIRECT_PUBLISH';

-- Backfill: alinear con canPublish existente (sin dejar pares contradictorios).
UPDATE "InfoSpotUserRole"
SET "publicationPolicy" = CASE
  WHEN "role" = 'INFOSPOT_DIRECTOR' THEN 'DIRECT_PUBLISH'::"InfoSpotPublicationPolicy"
  WHEN "role" = 'INFOSPOT_COLABORADOR' THEN 'REQUIRES_APPROVAL'::"InfoSpotPublicationPolicy"
  WHEN "canPublish" = false THEN 'REQUIRES_APPROVAL'::"InfoSpotPublicationPolicy"
  ELSE 'DIRECT_PUBLISH'::"InfoSpotPublicationPolicy"
END;

-- Forzar canPublish coherente con la política y el rol.
UPDATE "InfoSpotUserRole"
SET "canPublish" = CASE
  WHEN "role" = 'INFOSPOT_DIRECTOR' THEN true
  WHEN "role" = 'INFOSPOT_COLABORADOR' THEN false
  WHEN "publicationPolicy" = 'DIRECT_PUBLISH' THEN true
  ELSE false
END;

CREATE INDEX IF NOT EXISTS "InfoSpotUserRole_publicationPolicy_status_idx"
  ON "InfoSpotUserRole"("publicationPolicy", "status");
