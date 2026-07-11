-- Info Spot launch readiness: settings extendidos + etiquetas internas de contenido
CREATE TYPE "InfoSpotContentTag" AS ENUM ('DEMO', 'REAL', 'NEEDS_REVIEW');

ALTER TABLE "InfoSpotArticle"
  ADD COLUMN "contentTag" "InfoSpotContentTag" NOT NULL DEFAULT 'NEEDS_REVIEW';

ALTER TABLE "InfoSpotEvent"
  ADD COLUMN "contentTag" "InfoSpotContentTag" NOT NULL DEFAULT 'NEEDS_REVIEW';

ALTER TABLE "InfoSpotSettings"
  ADD COLUMN "pressEmail" TEXT,
  ADD COLUMN "whatsappUrl" TEXT,
  ADD COLUMN "publicUrl" TEXT,
  ADD COLUMN "baseCity" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'Argentina',
  ADD COLUMN "institutionalText" TEXT,
  ADD COLUMN "footerText" TEXT;

CREATE INDEX "InfoSpotArticle_contentTag_status_idx" ON "InfoSpotArticle"("contentTag", "status");
CREATE INDEX "InfoSpotEvent_contentTag_status_idx" ON "InfoSpotEvent"("contentTag", "status");

-- Marcar contenido seed conocido como DEMO (sin exponer públicamente)
UPDATE "InfoSpotEvent"
SET "contentTag" = 'DEMO'
WHERE "slug" LIKE 'demo-%';

UPDATE "InfoSpotArticle"
SET "contentTag" = 'DEMO'
WHERE "slug" IN (
  'arranca-info-spot-escena-local',
  'agenda-deportiva-fin-de-semana',
  'cultura-plaza-feria-musica',
  'fotografia-eventos-tips',
  'que-eventos-mirar-esta-semana'
);
