-- Info Spot editorial CMS (independent from CLF BlogPost)
-- Forward-only: enums, tables, indexes and FKs for Info Spot.

-- CreateEnum
CREATE TYPE "InfoSpotEditorialRole" AS ENUM ('INFOSPOT_DIRECTOR', 'INFOSPOT_REDACTOR');

-- CreateEnum
CREATE TYPE "InfoSpotMemberStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InfoSpotArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InfoSpotAssetSourceType" AS ENUM ('UPLOAD', 'CLF_PHOTO');

-- CreateTable
CREATE TABLE "InfoSpotUserRole" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "InfoSpotEditorialRole" NOT NULL,
    "canPublish" BOOLEAN NOT NULL DEFAULT true,
    "status" "InfoSpotMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoSpotCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoSpotEditorialAsset" (
    "id" TEXT NOT NULL,
    "sourceType" "InfoSpotAssetSourceType" NOT NULL,
    "sourcePhotoId" INTEGER,
    "sourceAlbumId" INTEGER,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "photographerName" TEXT,
    "photographerId" INTEGER,
    "caption" TEXT,
    "credit" TEXT,
    "copyrightText" TEXT,
    "isPermanentEditorialAsset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotEditorialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoSpotArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImageId" TEXT,
    "categoryId" TEXT,
    "authorId" INTEGER NOT NULL,
    "status" "InfoSpotArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "eventId" INTEGER,
    "clfAlbumId" INTEGER,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoSpotSettings" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "slogan" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "xUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "defaultShareImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InfoSpotUserRole_userId_key" ON "InfoSpotUserRole"("userId");

-- CreateIndex
CREATE INDEX "InfoSpotUserRole_role_status_idx" ON "InfoSpotUserRole"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InfoSpotCategory_slug_key" ON "InfoSpotCategory"("slug");

-- CreateIndex
CREATE INDEX "InfoSpotCategory_name_idx" ON "InfoSpotCategory"("name");

-- CreateIndex
CREATE INDEX "InfoSpotEditorialAsset_sourceType_idx" ON "InfoSpotEditorialAsset"("sourceType");

-- CreateIndex
CREATE INDEX "InfoSpotEditorialAsset_sourcePhotoId_idx" ON "InfoSpotEditorialAsset"("sourcePhotoId");

-- CreateIndex
CREATE INDEX "InfoSpotEditorialAsset_sourceAlbumId_idx" ON "InfoSpotEditorialAsset"("sourceAlbumId");

-- CreateIndex
CREATE INDEX "InfoSpotEditorialAsset_photographerId_idx" ON "InfoSpotEditorialAsset"("photographerId");

-- CreateIndex
CREATE UNIQUE INDEX "InfoSpotArticle_slug_key" ON "InfoSpotArticle"("slug");

-- CreateIndex
CREATE INDEX "InfoSpotArticle_status_publishedAt_idx" ON "InfoSpotArticle"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "InfoSpotArticle_categoryId_idx" ON "InfoSpotArticle"("categoryId");

-- CreateIndex
CREATE INDEX "InfoSpotArticle_authorId_idx" ON "InfoSpotArticle"("authorId");

-- CreateIndex
CREATE INDEX "InfoSpotArticle_eventId_idx" ON "InfoSpotArticle"("eventId");

-- CreateIndex
CREATE INDEX "InfoSpotArticle_clfAlbumId_idx" ON "InfoSpotArticle"("clfAlbumId");

-- AddForeignKey
ALTER TABLE "InfoSpotUserRole" ADD CONSTRAINT "InfoSpotUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoSpotArticle" ADD CONSTRAINT "InfoSpotArticle_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "InfoSpotEditorialAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoSpotArticle" ADD CONSTRAINT "InfoSpotArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InfoSpotCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoSpotArticle" ADD CONSTRAINT "InfoSpotArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
