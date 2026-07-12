-- Info Spot: orígenes de contenido genéricos + originKind en eventos.
-- No toca estados editoriales. Soft refs Article.eventId / clfAlbumId se conservan.

-- 1) Enums
CREATE TYPE "InfoSpotEventOriginKind" AS ENUM (
  'REDACCION',
  'PUBLIC_INTAKE',
  'IMPORTED',
  'AUTO_CREATED',
  'SYNCED_EXTERNAL'
);

CREATE TYPE "InfoSpotOriginContentType" AS ENUM ('ARTICLE', 'EVENT');

CREATE TYPE "InfoSpotOriginSourceType" AS ENUM (
  'INFOSPOT',
  'COMPRAMELAFOTO',
  'CSV',
  'AI',
  'RSS',
  'INSTAGRAM',
  'FACEBOOK',
  'API',
  'MANUAL'
);

CREATE TYPE "InfoSpotOriginExternalEntityType" AS ENUM (
  'EVENT',
  'ALBUM',
  'PHOTO',
  'POST',
  'FEED_ITEM',
  'UNKNOWN'
);

CREATE TYPE "InfoSpotOriginDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND',
  'BIDIRECTIONAL'
);

CREATE TYPE "InfoSpotOriginSyncStatus" AS ENUM (
  'PENDING',
  'SYNCED',
  'FAILED',
  'STALE',
  'DISABLED'
);

-- 2) originKind en eventos + backfill seguro
ALTER TABLE "InfoSpotEvent"
  ADD COLUMN "originKind" "InfoSpotEventOriginKind" NOT NULL DEFAULT 'REDACCION';

-- Intake público: tiene submission → PUBLIC_INTAKE
UPDATE "InfoSpotEvent" e
SET "originKind" = 'PUBLIC_INTAKE'
FROM "InfoSpotEventSubmission" s
WHERE s."eventId" = e."id"
  AND e."originKind" = 'REDACCION';

CREATE INDEX "InfoSpotEvent_originKind_idx" ON "InfoSpotEvent"("originKind");

-- 3) Tabla de orígenes
CREATE TABLE "InfoSpotContentOrigin" (
  "id" TEXT NOT NULL,
  "contentType" "InfoSpotOriginContentType" NOT NULL,
  "articleId" TEXT,
  "eventId" TEXT,
  "sourceType" "InfoSpotOriginSourceType" NOT NULL,
  "externalEntityType" "InfoSpotOriginExternalEntityType" NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalUrl" TEXT,
  "direction" "InfoSpotOriginDirection" NOT NULL DEFAULT 'INBOUND',
  "syncStatus" "InfoSpotOriginSyncStatus" NOT NULL DEFAULT 'PENDING',
  "lastSyncedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "syncError" TEXT,
  "operationalPayload" JSONB,
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotContentOrigin_pkey" PRIMARY KEY ("id")
);

-- Exactamente un destino editorial (Article XOR Event) alineado a contentType
ALTER TABLE "InfoSpotContentOrigin"
  ADD CONSTRAINT "InfoSpotContentOrigin_target_check" CHECK (
    (
      "contentType" = 'ARTICLE'
      AND "articleId" IS NOT NULL
      AND "eventId" IS NULL
    )
    OR
    (
      "contentType" = 'EVENT'
      AND "eventId" IS NOT NULL
      AND "articleId" IS NULL
    )
  );

-- Idempotencia: mismo origen externo no se vincula dos veces al mismo artículo
CREATE UNIQUE INDEX "InfoSpotContentOrigin_article_external_uidx"
  ON "InfoSpotContentOrigin" ("sourceType", "externalEntityType", "externalId", "articleId")
  WHERE "articleId" IS NOT NULL;

-- Idempotencia: mismo origen externo no se vincula dos veces al mismo evento
CREATE UNIQUE INDEX "InfoSpotContentOrigin_event_external_uidx"
  ON "InfoSpotContentOrigin" ("sourceType", "externalEntityType", "externalId", "eventId")
  WHERE "eventId" IS NOT NULL;

CREATE INDEX "InfoSpotContentOrigin_contentType_syncStatus_idx"
  ON "InfoSpotContentOrigin"("contentType", "syncStatus");
CREATE INDEX "InfoSpotContentOrigin_source_external_idx"
  ON "InfoSpotContentOrigin"("sourceType", "externalEntityType", "externalId");
CREATE INDEX "InfoSpotContentOrigin_articleId_idx"
  ON "InfoSpotContentOrigin"("articleId");
CREATE INDEX "InfoSpotContentOrigin_eventId_idx"
  ON "InfoSpotContentOrigin"("eventId");
CREATE INDEX "InfoSpotContentOrigin_syncStatus_lastAttemptAt_idx"
  ON "InfoSpotContentOrigin"("syncStatus", "lastAttemptAt");

ALTER TABLE "InfoSpotContentOrigin"
  ADD CONSTRAINT "InfoSpotContentOrigin_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InfoSpotContentOrigin"
  ADD CONSTRAINT "InfoSpotContentOrigin_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Nota: Article.eventId / clfAlbumId (soft refs Int) se mantienen por compatibilidad.
-- Un backfill dry-run puede proyectar filas hacia InfoSpotContentOrigin sin borrar soft refs.
