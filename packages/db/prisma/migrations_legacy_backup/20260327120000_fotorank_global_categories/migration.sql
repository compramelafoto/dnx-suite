-- FotoRank: catálogo global de categorías, alias, mapeo a categorías de concurso

CREATE TYPE "FotorankGlobalCategoryReviewStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');
CREATE TYPE "FotorankContestCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "FotorankGlobalCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "FotorankGlobalCategoryReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "suggestedByUserId" TEXT,
    "suggestionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankGlobalCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankGlobalCategory_slug_key" ON "FotorankGlobalCategory"("slug");
CREATE INDEX "FotorankGlobalCategory_reviewStatus_isActive_idx" ON "FotorankGlobalCategory"("reviewStatus", "isActive");
CREATE INDEX "FotorankGlobalCategory_parentId_idx" ON "FotorankGlobalCategory"("parentId");

ALTER TABLE "FotorankGlobalCategory" ADD CONSTRAINT "FotorankGlobalCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankGlobalCategory" ADD CONSTRAINT "FotorankGlobalCategory_suggestedByUserId_fkey" FOREIGN KEY ("suggestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FotorankGlobalCategoryAlias" (
    "id" TEXT NOT NULL,
    "globalCategoryId" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankGlobalCategoryAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankGlobalCategoryAlias_normalizedAlias_key" ON "FotorankGlobalCategoryAlias"("normalizedAlias");
CREATE INDEX "FotorankGlobalCategoryAlias_globalCategoryId_idx" ON "FotorankGlobalCategoryAlias"("globalCategoryId");

ALTER TABLE "FotorankGlobalCategoryAlias" ADD CONSTRAINT "FotorankGlobalCategoryAlias_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankContestCategory" ADD COLUMN "status" "FotorankContestCategoryStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "FotorankContestCategory" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotorankContestCategory" ADD COLUMN "sourceGlobalCategoryId" TEXT;
ALTER TABLE "FotorankContestCategory" ADD COLUMN "linkedPendingGlobalCategoryId" TEXT;
ALTER TABLE "FotorankContestCategory" ADD COLUMN "mappingIncomplete" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "FotorankContestCategory_contestId_status_idx" ON "FotorankContestCategory"("contestId", "status");

ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_sourceGlobalCategoryId_fkey" FOREIGN KEY ("sourceGlobalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_linkedPendingGlobalCategoryId_fkey" FOREIGN KEY ("linkedPendingGlobalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FotorankContestCategoryGlobalCategory" (
    "id" TEXT NOT NULL,
    "contestCategoryId" TEXT NOT NULL,
    "globalCategoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestCategoryGlobalCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankContestCategoryGlobalCategory_contestCategoryId_global_key" ON "FotorankContestCategoryGlobalCategory"("contestCategoryId", "globalCategoryId");
CREATE INDEX "FotorankContestCategoryGlobalCategory_globalCategoryId_idx" ON "FotorankContestCategoryGlobalCategory"("globalCategoryId");

ALTER TABLE "FotorankContestCategoryGlobalCategory" ADD CONSTRAINT "FotorankContestCategoryGlobalCategory_contestCategoryId_fkey" FOREIGN KEY ("contestCategoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankContestCategoryGlobalCategory" ADD CONSTRAINT "FotorankContestCategoryGlobalCategory_globalCategoryId_fkey" FOREIGN KEY ("globalCategoryId") REFERENCES "FotorankGlobalCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
