-- CLF blog / marketing / leads gap (monorepo schema vs applied migrations)
-- Generated from `prisma migrate diff` (staging DB → schema.prisma), filtered to gap models only.
-- Forward-only: creates enums, tables, indexes and FKs missing in staging.

-- CreateEnum
CREATE TYPE "DnxCourseEnrollmentStatus" AS ENUM ('PENDING_PAYMENT', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogPostType" AS ENUM ('BLOG', 'FEATURE', 'CASE_STUDY', 'COMPARISON');

-- CreateEnum
CREATE TYPE "TalkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TalkModality" AS ENUM ('MEET', 'ONLINE', 'PRESENCIAL', 'OTHER');

-- CreateTable
CREATE TABLE "FotoOfficeInterest" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "email" TEXT,
    "name" TEXT,
    "source" TEXT NOT NULL,
    "interestType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotoOfficeInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talk" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "speakerName" TEXT,
    "badgeText" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "modality" "TalkModality" NOT NULL DEFAULT 'ONLINE',
    "meetUrl" TEXT,
    "calendarUrl" TEXT,
    "whatsappGroupUrl" TEXT,
    "heroImageUrl" TEXT,
    "primaryCtaText" TEXT,
    "secondaryCtaText" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "status" "TalkStatus" NOT NULL DEFAULT 'DRAFT',
    "showFaq" BOOLEAN NOT NULL DEFAULT true,
    "enableLeadCapture" BOOLEAN NOT NULL DEFAULT true,
    "enableCalendarStep" BOOLEAN NOT NULL DEFAULT true,
    "enableWhatsappStep" BOOLEAN NOT NULL DEFAULT true,
    "requireName" BOOLEAN NOT NULL DEFAULT true,
    "requireWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "requireEmail" BOOLEAN NOT NULL DEFAULT true,
    "sourceTag" TEXT,
    "internalNotes" TEXT,
    "problemPointsJson" JSONB,
    "solutionPointsJson" JSONB,
    "agendaPointsJson" JSONB,
    "stepsJson" JSONB,
    "faqJson" JSONB,
    "reminderTemplate" TEXT,
    "groupInviteTemplate" TEXT,
    "followUpTemplate" TEXT,

    CONSTRAINT "Talk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalkLead" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "talkId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "calendarClickedAt" TIMESTAMP(3),
    "whatsappClickedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "attendedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "interestedAt" TIMESTAMP(3),
    "notes" TEXT,
    "tagsJson" JSONB,
    "city" TEXT,
    "photographyType" TEXT,

    CONSTRAINT "TalkLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogTag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "BlogTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogAuthor" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT,
    "userId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BlogAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogMedia" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,

    CONSTRAINT "BlogMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentJson" JSONB NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "BlogPostType" NOT NULL DEFAULT 'BLOG',
    "publishedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "readingTimeMin" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoGoal" TEXT,
    "ogImageUrl" TEXT,
    "canonicalUrl" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "categoryId" INTEGER,
    "authorId" INTEGER,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostView" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "visitorKey" VARCHAR(64) NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostTag" (
    "postId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "BlogPostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "BlogSubscriber" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmTokenHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharlaFotoEscolarLead" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'charlafotoescolar',
    "city" TEXT,
    "photographyType" TEXT,
    "calendarClickedAt" TIMESTAMP(3),
    "whatsappClickedAt" TIMESTAMP(3),

    CONSTRAINT "CharlaFotoEscolarLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnxCourseEnrollment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseKey" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "DnxCourseEnrollmentStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amountArs" INTEGER NOT NULL,
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "DnxCourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnxCourseLead" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseKey" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,

    CONSTRAINT "DnxCourseLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatorCapture" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "takenByName" TEXT,
    "takenByEmail" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotoOfficeInterest_userId_interestType_source_idx" ON "FotoOfficeInterest"("userId", "interestType", "source");

-- CreateIndex
CREATE INDEX "FotoOfficeInterest_email_interestType_source_idx" ON "FotoOfficeInterest"("email", "interestType", "source");

-- CreateIndex
CREATE INDEX "FotoOfficeInterest_createdAt_idx" ON "FotoOfficeInterest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Talk_slug_key" ON "Talk"("slug");

-- CreateIndex
CREATE INDEX "Talk_status_idx" ON "Talk"("status");

-- CreateIndex
CREATE INDEX "Talk_eventDate_idx" ON "Talk"("eventDate");

-- CreateIndex
CREATE INDEX "Talk_createdAt_idx" ON "Talk"("createdAt");

-- CreateIndex
CREATE INDEX "TalkLead_talkId_idx" ON "TalkLead"("talkId");

-- CreateIndex
CREATE INDEX "TalkLead_createdAt_idx" ON "TalkLead"("createdAt");

-- CreateIndex
CREATE INDEX "TalkLead_email_idx" ON "TalkLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateIndex
CREATE INDEX "BlogCategory_sortOrder_idx" ON "BlogCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BlogTag_slug_key" ON "BlogTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogAuthor_slug_key" ON "BlogAuthor"("slug");

-- CreateIndex
CREATE INDEX "BlogAuthor_isActive_idx" ON "BlogAuthor"("isActive");

-- CreateIndex
CREATE INDEX "BlogMedia_createdAt_idx" ON "BlogMedia"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_status_isFeatured_idx" ON "BlogPost"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "BlogPost_categoryId_idx" ON "BlogPost"("categoryId");

-- CreateIndex
CREATE INDEX "BlogPost_type_idx" ON "BlogPost"("type");

-- CreateIndex
CREATE INDEX "BlogPostView_postId_idx" ON "BlogPostView"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostView_postId_visitorKey_key" ON "BlogPostView"("postId", "visitorKey");

-- CreateIndex
CREATE INDEX "BlogPostTag_tagId_idx" ON "BlogPostTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSubscriber_email_key" ON "BlogSubscriber"("email");

-- CreateIndex
CREATE INDEX "BlogSubscriber_confirmed_idx" ON "BlogSubscriber"("confirmed");

-- CreateIndex
CREATE INDEX "BlogSubscriber_createdAt_idx" ON "BlogSubscriber"("createdAt");

-- CreateIndex
CREATE INDEX "CharlaFotoEscolarLead_createdAt_idx" ON "CharlaFotoEscolarLead"("createdAt");

-- CreateIndex
CREATE INDEX "CharlaFotoEscolarLead_email_idx" ON "CharlaFotoEscolarLead"("email");

-- CreateIndex
CREATE INDEX "DnxCourseEnrollment_courseKey_status_idx" ON "DnxCourseEnrollment"("courseKey", "status");

-- CreateIndex
CREATE INDEX "DnxCourseEnrollment_courseKey_email_idx" ON "DnxCourseEnrollment"("courseKey", "email");

-- CreateIndex
CREATE INDEX "DnxCourseEnrollment_createdAt_idx" ON "DnxCourseEnrollment"("createdAt");

-- CreateIndex
CREATE INDEX "DnxCourseLead_courseKey_createdAt_idx" ON "DnxCourseLead"("courseKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DnxCourseLead_courseKey_email_key" ON "DnxCourseLead"("courseKey", "email");

-- CreateIndex
CREATE INDEX "SimulatorCapture_userId_expiresAt_idx" ON "SimulatorCapture"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "SimulatorCapture_expiresAt_idx" ON "SimulatorCapture"("expiresAt");

-- AddForeignKey
ALTER TABLE "FotoOfficeInterest" ADD CONSTRAINT "FotoOfficeInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalkLead" ADD CONSTRAINT "TalkLead_talkId_fkey" FOREIGN KEY ("talkId") REFERENCES "Talk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogAuthor" ADD CONSTRAINT "BlogAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "BlogAuthor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostView" ADD CONSTRAINT "BlogPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostTag" ADD CONSTRAINT "BlogPostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostTag" ADD CONSTRAINT "BlogPostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "BlogTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatorCapture" ADD CONSTRAINT "SimulatorCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
