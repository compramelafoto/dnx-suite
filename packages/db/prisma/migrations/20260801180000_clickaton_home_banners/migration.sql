-- CreateEnum
CREATE TYPE "ClickatonHomeBannerLinkType" AS ENUM ('EDITION', 'INTERNAL', 'EXTERNAL');

-- CreateTable
CREATE TABLE "ClickatonHomeBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "description" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Ver más',
    "linkType" "ClickatonHomeBannerLinkType" NOT NULL DEFAULT 'INTERNAL',
    "href" TEXT,
    "editionId" TEXT,
    "imageUrl" TEXT,
    "imageUrlVertical" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonHomeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClickatonHomeBanner_isActive_sortOrder_idx" ON "ClickatonHomeBanner"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ClickatonHomeBanner_publishedAt_idx" ON "ClickatonHomeBanner"("publishedAt");

-- CreateIndex
CREATE INDEX "ClickatonHomeBanner_editionId_idx" ON "ClickatonHomeBanner"("editionId");

-- AddForeignKey
ALTER TABLE "ClickatonHomeBanner" ADD CONSTRAINT "ClickatonHomeBanner_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
