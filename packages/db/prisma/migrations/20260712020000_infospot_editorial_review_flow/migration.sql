-- Info Spot PASO 19: flujo de revisión editorial
-- Extiende estados (no destructivo) + observaciones + auditoría.

ALTER TYPE "InfoSpotArticleStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "InfoSpotArticleStatus" ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH';

DO $$ BEGIN
  CREATE TYPE "InfoSpotArticleObservationType" AS ENUM ('RETURN', 'NOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "submittedForReviewAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "submittedForReviewByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "approvedByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "publishedByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "unpublishedAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "unpublishedByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "returnedByUserId" INTEGER;

CREATE INDEX IF NOT EXISTS "InfoSpotArticle_submittedForReviewAt_idx"
  ON "InfoSpotArticle"("submittedForReviewAt");
CREATE INDEX IF NOT EXISTS "InfoSpotArticle_returnedAt_idx"
  ON "InfoSpotArticle"("returnedAt");
CREATE INDEX IF NOT EXISTS "InfoSpotArticle_approvedAt_idx"
  ON "InfoSpotArticle"("approvedAt");

CREATE TABLE IF NOT EXISTS "InfoSpotArticleObservation" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "authorUserId" INTEGER NOT NULL,
  "type" "InfoSpotArticleObservationType" NOT NULL DEFAULT 'RETURN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InfoSpotArticleObservation_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "InfoSpotArticleObservation"
    ADD CONSTRAINT "InfoSpotArticleObservation_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InfoSpotArticleObservation"
    ADD CONSTRAINT "InfoSpotArticleObservation_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "InfoSpotArticleObservation_articleId_createdAt_idx"
  ON "InfoSpotArticleObservation"("articleId", "createdAt");
CREATE INDEX IF NOT EXISTS "InfoSpotArticleObservation_authorUserId_idx"
  ON "InfoSpotArticleObservation"("authorUserId");
CREATE INDEX IF NOT EXISTS "InfoSpotArticleObservation_type_idx"
  ON "InfoSpotArticleObservation"("type");
