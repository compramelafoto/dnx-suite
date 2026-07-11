-- CreateEnum
CREATE TYPE "InfoSpotEventStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InfoSpotEventSubmissionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "InfoSpotEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "organizerName" TEXT NOT NULL,
    "organizerEmail" TEXT NOT NULL,
    "organizerPhone" TEXT,
    "organizerWebsite" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "venueName" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "coverImageUrl" TEXT,
    "coverImageKey" TEXT,
    "registrationUrl" TEXT,
    "sourceUrl" TEXT,
    "status" "InfoSpotEventStatus" NOT NULL DEFAULT 'DRAFT',
    "internalNotes" TEXT,
    "submittedByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoSpotEventSubmission" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "InfoSpotEventSubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InfoSpotEventSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InfoSpotEvent_slug_key" ON "InfoSpotEvent"("slug");

-- CreateIndex
CREATE INDEX "InfoSpotEvent_status_startAt_idx" ON "InfoSpotEvent"("status", "startAt");

-- CreateIndex
CREATE INDEX "InfoSpotEvent_status_publishedAt_idx" ON "InfoSpotEvent"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "InfoSpotEvent_categoryId_idx" ON "InfoSpotEvent"("categoryId");

-- CreateIndex
CREATE INDEX "InfoSpotEvent_city_province_idx" ON "InfoSpotEvent"("city", "province");

-- CreateIndex
CREATE INDEX "InfoSpotEvent_startAt_idx" ON "InfoSpotEvent"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "InfoSpotEventSubmission_eventId_key" ON "InfoSpotEventSubmission"("eventId");

-- CreateIndex
CREATE INDEX "InfoSpotEventSubmission_status_createdAt_idx" ON "InfoSpotEventSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InfoSpotEventSubmission_ipHash_createdAt_idx" ON "InfoSpotEventSubmission"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "InfoSpotEvent" ADD CONSTRAINT "InfoSpotEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InfoSpotCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoSpotEventSubmission" ADD CONSTRAINT "InfoSpotEventSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InfoSpotEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
