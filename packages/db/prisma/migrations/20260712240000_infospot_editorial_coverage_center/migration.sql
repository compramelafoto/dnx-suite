-- Info Spot: Centro Editorial de Coberturas (álbum-first).
-- No altera sync inbound/outbound de eventos ni estados editoriales de publicación.

CREATE TYPE "InfoSpotCoverageDiscoveryStatus" AS ENUM (
  'DISCOVERED',
  'QUEUED',
  'DISMISSED',
  'LINKED'
);

CREATE TYPE "InfoSpotCoverageEditorialStatus" AS ENUM (
  'UNASSIGNED',
  'DRAFTING',
  'IN_REVIEW',
  'READY',
  'PUBLISHED',
  'STALE'
);

CREATE TYPE "InfoSpotCoverageSyncStatus" AS ENUM (
  'PENDING',
  'SYNCED',
  'FAILED',
  'STALE',
  'DISABLED'
);

CREATE TYPE "InfoSpotCoveragePhotographerRole" AS ENUM (
  'PRIMARY',
  'COLLABORATOR',
  'CONTRIBUTOR'
);

CREATE TYPE "InfoSpotCoverageArticleRole" AS ENUM (
  'PRIMARY',
  'FOLLOW_UP',
  'GALLERY_ONLY'
);

CREATE TYPE "InfoSpotCoverageAiPrepStatus" AS ENUM (
  'NOT_READY',
  'READY',
  'QUEUED',
  'COMPLETED'
);

CREATE TYPE "InfoSpotCoveragePhotoSelectorStatus" AS ENUM (
  'NOT_READY',
  'READY',
  'IN_PROGRESS'
);

CREATE TYPE "InfoSpotCoverageCreditsStatus" AS ENUM (
  'NOT_READY',
  'READY',
  'PENDING_REVIEW'
);

CREATE TABLE "InfoSpotCoverage" (
  "id" TEXT NOT NULL,
  "clfAlbumId" INTEGER NOT NULL,
  "clfEventId" INTEGER,
  "title" TEXT NOT NULL,
  "publicSlug" TEXT NOT NULL,
  "publicUrl" TEXT,
  "coverThumbnailUrl" TEXT,
  "city" TEXT,
  "eventTitle" TEXT,
  "photoCount" INTEGER NOT NULL DEFAULT 0,
  "discoveryStatus" "InfoSpotCoverageDiscoveryStatus" NOT NULL DEFAULT 'DISCOVERED',
  "editorialStatus" "InfoSpotCoverageEditorialStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "syncStatus" "InfoSpotCoverageSyncStatus" NOT NULL DEFAULT 'PENDING',
  "commercialStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "commercialReason" TEXT,
  "canShowPurchaseCta" BOOLEAN NOT NULL DEFAULT false,
  "operationalSnapshot" JSONB,
  "priorityScore" INTEGER NOT NULL DEFAULT 0,
  "assignedToUserId" INTEGER,
  "dismissedAt" TIMESTAMP(3),
  "dismissedReason" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "aiPrepStatus" "InfoSpotCoverageAiPrepStatus" NOT NULL DEFAULT 'NOT_READY',
  "photoSelectorStatus" "InfoSpotCoveragePhotoSelectorStatus" NOT NULL DEFAULT 'NOT_READY',
  "creditsStatus" "InfoSpotCoverageCreditsStatus" NOT NULL DEFAULT 'NOT_READY',
  "aiPrepMeta" JSONB,
  "photoSelectorMeta" JSONB,
  "creditsMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotCoverage_clfAlbumId_key" ON "InfoSpotCoverage"("clfAlbumId");
CREATE INDEX "InfoSpotCoverage_clfEventId_idx" ON "InfoSpotCoverage"("clfEventId");
CREATE INDEX "InfoSpotCoverage_discoveryStatus_editorialStatus_idx"
  ON "InfoSpotCoverage"("discoveryStatus", "editorialStatus");
CREATE INDEX "InfoSpotCoverage_syncStatus_lastSyncedAt_idx"
  ON "InfoSpotCoverage"("syncStatus", "lastSyncedAt");
CREATE INDEX "InfoSpotCoverage_commercialStatus_idx" ON "InfoSpotCoverage"("commercialStatus");
CREATE INDEX "InfoSpotCoverage_priorityScore_idx" ON "InfoSpotCoverage"("priorityScore");
CREATE INDEX "InfoSpotCoverage_assignedToUserId_idx" ON "InfoSpotCoverage"("assignedToUserId");

ALTER TABLE "InfoSpotCoverage"
  ADD CONSTRAINT "InfoSpotCoverage_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InfoSpotCoveragePhotographer" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "clfUserId" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "InfoSpotCoveragePhotographerRole" NOT NULL DEFAULT 'PRIMARY',
  "photoCount" INTEGER NOT NULL DEFAULT 0,
  "creditHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InfoSpotCoveragePhotographer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotCoveragePhotographer_coverageId_clfUserId_key"
  ON "InfoSpotCoveragePhotographer"("coverageId", "clfUserId");
CREATE INDEX "InfoSpotCoveragePhotographer_clfUserId_idx"
  ON "InfoSpotCoveragePhotographer"("clfUserId");

ALTER TABLE "InfoSpotCoveragePhotographer"
  ADD CONSTRAINT "InfoSpotCoveragePhotographer_coverageId_fkey"
  FOREIGN KEY ("coverageId") REFERENCES "InfoSpotCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InfoSpotCoverageArticle" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "linkRole" "InfoSpotCoverageArticleRole" NOT NULL DEFAULT 'PRIMARY',
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedByUserId" INTEGER,
  CONSTRAINT "InfoSpotCoverageArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InfoSpotCoverageArticle_coverageId_articleId_key"
  ON "InfoSpotCoverageArticle"("coverageId", "articleId");
CREATE INDEX "InfoSpotCoverageArticle_articleId_idx" ON "InfoSpotCoverageArticle"("articleId");
CREATE INDEX "InfoSpotCoverageArticle_linkedByUserId_idx" ON "InfoSpotCoverageArticle"("linkedByUserId");

ALTER TABLE "InfoSpotCoverageArticle"
  ADD CONSTRAINT "InfoSpotCoverageArticle_coverageId_fkey"
  FOREIGN KEY ("coverageId") REFERENCES "InfoSpotCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotCoverageArticle"
  ADD CONSTRAINT "InfoSpotCoverageArticle_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "InfoSpotArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotCoverageArticle"
  ADD CONSTRAINT "InfoSpotCoverageArticle_linkedByUserId_fkey"
  FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON TABLE "InfoSpotCoverage" IS
  'Centro Editorial: 1 fila por álbum CLF público. Sync idempotente; no publica.';
