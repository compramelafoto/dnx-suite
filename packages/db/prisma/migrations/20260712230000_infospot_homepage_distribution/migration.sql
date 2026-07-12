-- Info Spot: motor de distribución de home (placements, prioridad, métricas).
-- No altera estados editoriales ni sync CLF.

-- 1) Campos de distribución en artículos y eventos
ALTER TABLE "InfoSpotArticle"
  ADD COLUMN "editorialPriority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "excludeFromHomepage" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InfoSpotEvent"
  ADD COLUMN "editorialPriority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "excludeFromHomepage" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "InfoSpotArticle_excludeFromHomepage_status_idx"
  ON "InfoSpotArticle"("excludeFromHomepage", "status");
CREATE INDEX "InfoSpotArticle_editorialPriority_idx"
  ON "InfoSpotArticle"("editorialPriority");
CREATE INDEX "InfoSpotEvent_excludeFromHomepage_status_idx"
  ON "InfoSpotEvent"("excludeFromHomepage", "status");
CREATE INDEX "InfoSpotEvent_editorialPriority_idx"
  ON "InfoSpotEvent"("editorialPriority");

-- 2) Placements de portada
CREATE TYPE "InfoSpotHomepagePlacementType" AS ENUM ('HERO', 'FEATURED_EVENT');

CREATE TABLE "InfoSpotHomepagePlacement" (
  "id" TEXT NOT NULL,
  "placementType" "InfoSpotHomepagePlacementType" NOT NULL,
  "articleId" TEXT,
  "eventId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "customTitle" TEXT,
  "customSubtitle" TEXT,
  "customImageUrl" TEXT,
  "createdByUserId" INTEGER NOT NULL,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotHomepagePlacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InfoSpotHomepagePlacement_xor_target"
    CHECK (
      (("articleId" IS NOT NULL AND "eventId" IS NULL)
        OR ("articleId" IS NULL AND "eventId" IS NOT NULL))
    )
);

CREATE INDEX "InfoSpotHomepagePlacement_placementType_isActive_idx"
  ON "InfoSpotHomepagePlacement"("placementType", "isActive");
CREATE INDEX "InfoSpotHomepagePlacement_startsAt_endsAt_idx"
  ON "InfoSpotHomepagePlacement"("startsAt", "endsAt");
CREATE INDEX "InfoSpotHomepagePlacement_sortOrder_idx"
  ON "InfoSpotHomepagePlacement"("sortOrder");
CREATE INDEX "InfoSpotHomepagePlacement_articleId_idx"
  ON "InfoSpotHomepagePlacement"("articleId");
CREATE INDEX "InfoSpotHomepagePlacement_eventId_idx"
  ON "InfoSpotHomepagePlacement"("eventId");
CREATE INDEX "InfoSpotHomepagePlacement_priority_idx"
  ON "InfoSpotHomepagePlacement"("priority");

ALTER TABLE "InfoSpotHomepagePlacement"
  ADD CONSTRAINT "InfoSpotHomepagePlacement_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotHomepagePlacement"
  ADD CONSTRAINT "InfoSpotHomepagePlacement_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotHomepagePlacement"
  ADD CONSTRAINT "InfoSpotHomepagePlacement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfoSpotHomepagePlacement"
  ADD CONSTRAINT "InfoSpotHomepagePlacement_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Métricas diarias
CREATE TYPE "InfoSpotContentMetricKind" AS ENUM (
  'EVENT_VIEW',
  'ARTICLE_VIEW',
  'CLF_REGISTRATION_CLICK',
  'EVENT_CLICK',
  'ALBUM_CLICK',
  'PURCHASE_CLICK'
);

CREATE TABLE "InfoSpotContentMetricDaily" (
  "id" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "kind" "InfoSpotContentMetricKind" NOT NULL,
  "contentKey" TEXT NOT NULL,
  "articleId" TEXT,
  "eventId" TEXT,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotContentMetricDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotContentMetricDaily_day_kind_contentKey_key"
  ON "InfoSpotContentMetricDaily"("day", "kind", "contentKey");
CREATE INDEX "InfoSpotContentMetricDaily_kind_day_idx"
  ON "InfoSpotContentMetricDaily"("kind", "day");
CREATE INDEX "InfoSpotContentMetricDaily_articleId_day_idx"
  ON "InfoSpotContentMetricDaily"("articleId", "day");
CREATE INDEX "InfoSpotContentMetricDaily_eventId_day_idx"
  ON "InfoSpotContentMetricDaily"("eventId", "day");

COMMENT ON TABLE "InfoSpotHomepagePlacement" IS
  'Selección editorial manual para bloques de home. XOR articleId/eventId.';
COMMENT ON COLUMN "InfoSpotEvent"."editorialPriority" IS
  '0–100. Afecta score de home; no publica.';
COMMENT ON COLUMN "InfoSpotEvent"."excludeFromHomepage" IS
  'Excluye de bloques automáticos sin despublicar.';
