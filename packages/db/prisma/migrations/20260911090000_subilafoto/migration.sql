-- CreateEnum
CREATE TYPE "SubilafotoEventStatus" AS ENUM ('CONFIGURING', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubilafotoOrderKind" AS ENUM ('EVENT', 'DOWNLOAD_ADDON');

-- CreateEnum
CREATE TYPE "SubilafotoOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SubilafotoDownloadStatus" AS ENUM ('NOT_OFFERED', 'OFFERED', 'PURCHASED', 'DELIVERED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubilafotoDownloadMode" AS ENUM ('INCLUDED', 'PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SubilafotoEventType" AS ENUM ('BODA', 'QUINCE', 'CUMPLEANOS', 'ANIVERSARIO', 'BAUTISMO_COMUNION', 'EGRESO_ACTO_ESCOLAR', 'FIESTA_EMPRESARIAL', 'CONGRESO', 'CONVENCION', 'CONFERENCIA', 'JORNADA_SEMINARIO', 'EXPOSICION_FERIA', 'LANZAMIENTO', 'INSTITUCIONAL', 'DEPORTIVO', 'RECITAL', 'GASTRONOMICO', 'ASOCIACION', 'VIAJE_GRUPAL', 'OTRO');

-- CreateEnum
CREATE TYPE "SubilafotoVisibility" AS ENUM ('LINK_ONLY', 'CODE_REQUIRED', 'UNLISTED');

-- CreateEnum
CREATE TYPE "SubilafotoModerationProfile" AS ENUM ('FAMILIAR', 'SOCIAL', 'EMPRESARIAL');

-- CreateEnum
CREATE TYPE "SubilafotoMediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'APPROVED', 'REVIEW_REQUIRED', 'BLOCKED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "SubilafotoMediaKind" AS ENUM ('PHOTO', 'VIDEO', 'MESSAGE');

-- CreateEnum
CREATE TYPE "SubilafotoMediaOrigin" AS ENUM ('GUEST', 'PHOTOGRAPHER', 'ORGANIZER', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SubilafotoScreenMode" AS ENUM ('FULL_PHOTO', 'MOSAIC', 'CAROUSEL', 'COLLAGE', 'RAIN', 'MESSAGES', 'FEATURED', 'QR_CARD', 'COVER_PAUSE', 'CLOSING');

-- CreateEnum
CREATE TYPE "SubilafotoLinkKind" AS ENUM ('GUEST', 'SCREEN', 'DEMO_GUEST', 'DEMO_SCREEN', 'VENDOR', 'CLIENT');

-- CreateEnum
CREATE TYPE "SubilafotoCollaboratorRole" AS ENUM ('MODERATOR', 'SCREEN_OPERATOR', 'EVENT_ADMIN');

-- CreateEnum
CREATE TYPE "SubilafotoPackageStatus" AS ENUM ('QUEUED', 'BUILDING', 'READY', 'FAILED', 'EXPIRED', 'PURGED');

-- CreateEnum
CREATE TYPE "SubilafotoConsentKind" AS ENUM ('TERMS', 'PROMOTIONAL_USE', 'MINOR_AUTHORIZATION');

-- AlterEnum
ALTER TYPE "SuiteApp" ADD VALUE 'SUBILAFOTO';

-- CreateTable
CREATE TABLE "SubilafotoSellerProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "workspaceId" TEXT,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "brandColor" TEXT,
    "basePriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "downloadMode" "SubilafotoDownloadMode" NOT NULL DEFAULT 'PERCENT',
    "downloadPercentBps" INTEGER DEFAULT 1500,
    "downloadPriceCents" INTEGER,
    "termsText" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "mpConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoSellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoOrder" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "eventId" TEXT,
    "kind" "SubilafotoOrderKind" NOT NULL,
    "status" "SubilafotoOrderStatus" NOT NULL DEFAULT 'PENDING',
    "buyerEmail" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "platformFeeBps" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "sellerNetCents" INTEGER NOT NULL,
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "mpCollectorId" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoEvent" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "screenCode" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "eventType" "SubilafotoEventType" NOT NULL DEFAULT 'OTRO',
    "description" TEXT,
    "hostsLabel" TEXT,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "venueMapUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "activationAt" TIMESTAMP(3),
    "windowHours" INTEGER NOT NULL DEFAULT 12,
    "deactivationAt" TIMESTAMP(3),
    "status" "SubilafotoEventStatus" NOT NULL DEFAULT 'CONFIGURING',
    "closedAt" TIMESTAMP(3),
    "demoTestedAt" TIMESTAMP(3),
    "demoPurgedAt" TIMESTAMP(3),
    "templateId" TEXT,
    "themeTokens" JSONB,
    "coverUrl" TEXT,
    "closingCardText" TEXT,
    "allowPhotos" BOOLEAN NOT NULL DEFAULT true,
    "allowVideos" BOOLEAN NOT NULL DEFAULT false,
    "allowMessages" BOOLEAN NOT NULL DEFAULT true,
    "askGuestName" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "maxUploadsPerGuest" INTEGER DEFAULT 30,
    "visibility" "SubilafotoVisibility" NOT NULL DEFAULT 'LINK_ONLY',
    "accessCode" TEXT,
    "guestsCanSeeAlbum" BOOLEAN NOT NULL DEFAULT true,
    "guestsCanDownload" BOOLEAN NOT NULL DEFAULT false,
    "moderationProfile" "SubilafotoModerationProfile" NOT NULL DEFAULT 'SOCIAL',
    "downloadStatus" "SubilafotoDownloadStatus" NOT NULL DEFAULT 'NOT_OFFERED',
    "retentionUntil" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "previewUrl" TEXT,
    "tokens" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestSessionId" TEXT,
    "kind" "SubilafotoMediaKind" NOT NULL DEFAULT 'PHOTO',
    "origin" "SubilafotoMediaOrigin" NOT NULL DEFAULT 'GUEST',
    "status" "SubilafotoMediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "originalKey" TEXT NOT NULL,
    "originalBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "contentType" TEXT,
    "checksum" TEXT,
    "guestName" TEXT,
    "caption" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenByUserId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoMediaVariant" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoMediaVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoModerationDecision" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT,
    "policyVersion" TEXT NOT NULL,
    "profile" "SubilafotoModerationProfile" NOT NULL,
    "decision" "SubilafotoMediaStatus" NOT NULL,
    "labels" JSONB,
    "topLabel" TEXT,
    "topConfidence" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overriddenBy" INTEGER,
    "overrideReason" TEXT,
    "overriddenAt" TIMESTAMP(3),

    CONSTRAINT "SubilafotoModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoGuestSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "displayName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "uploadCount" INTEGER NOT NULL DEFAULT 0,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoGuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoScreen" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT,
    "pairingCode" TEXT NOT NULL,
    "mode" "SubilafotoScreenMode" NOT NULL DEFAULT 'FULL_PHOTO',
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "showQr" BOOLEAN NOT NULL DEFAULT true,
    "speedMs" INTEGER NOT NULL DEFAULT 6000,
    "lastSeenAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoAccessLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "SubilafotoLinkKind" NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoAccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoCollaborator" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER,
    "email" TEXT,
    "role" "SubilafotoCollaboratorRole" NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SubilafotoCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoEventVendor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "roleNote" TEXT,
    "invitedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "invitationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoEventVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoPackage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "SubilafotoPackageStatus" NOT NULL DEFAULT 'QUEUED',
    "partIndex" INTEGER NOT NULL DEFAULT 1,
    "partCount" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT,
    "bytes" BIGINT,
    "itemCount" INTEGER,
    "manifest" JSONB,
    "checksum" TEXT,
    "downloadToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "regenerations" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoConsent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestSessionId" TEXT,
    "subjectEmail" TEXT,
    "kind" "SubilafotoConsentKind" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ipHash" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubilafotoAudit" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "actorUserId" INTEGER,
    "actorKind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubilafotoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoSellerProfile_slug_key" ON "SubilafotoSellerProfile"("slug");

-- CreateIndex
CREATE INDEX "SubilafotoSellerProfile_userId_idx" ON "SubilafotoSellerProfile"("userId");

-- CreateIndex
CREATE INDEX "SubilafotoSellerProfile_isPublished_idx" ON "SubilafotoSellerProfile"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoOrder_eventId_key" ON "SubilafotoOrder"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoOrder_mpPaymentId_key" ON "SubilafotoOrder"("mpPaymentId");

-- CreateIndex
CREATE INDEX "SubilafotoOrder_sellerProfileId_idx" ON "SubilafotoOrder"("sellerProfileId");

-- CreateIndex
CREATE INDEX "SubilafotoOrder_status_kind_idx" ON "SubilafotoOrder"("status", "kind");

-- CreateIndex
CREATE INDEX "SubilafotoOrder_buyerEmail_idx" ON "SubilafotoOrder"("buyerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoEvent_code_key" ON "SubilafotoEvent"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoEvent_screenCode_key" ON "SubilafotoEvent"("screenCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoEvent_slug_key" ON "SubilafotoEvent"("slug");

-- CreateIndex
CREATE INDEX "SubilafotoEvent_sellerProfileId_idx" ON "SubilafotoEvent"("sellerProfileId");

-- CreateIndex
CREATE INDEX "SubilafotoEvent_status_activationAt_idx" ON "SubilafotoEvent"("status", "activationAt");

-- CreateIndex
CREATE INDEX "SubilafotoEvent_retentionUntil_idx" ON "SubilafotoEvent"("retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoTemplate_key_key" ON "SubilafotoTemplate"("key");

-- CreateIndex
CREATE INDEX "SubilafotoTemplate_isActive_sortOrder_idx" ON "SubilafotoTemplate"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SubilafotoMedia_eventId_status_publishedAt_idx" ON "SubilafotoMedia"("eventId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "SubilafotoMedia_status_createdAt_idx" ON "SubilafotoMedia"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SubilafotoMedia_guestSessionId_idx" ON "SubilafotoMedia"("guestSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoMedia_eventId_checksum_key" ON "SubilafotoMedia"("eventId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoMediaVariant_mediaId_label_key" ON "SubilafotoMediaVariant"("mediaId", "label");

-- CreateIndex
CREATE INDEX "SubilafotoModerationDecision_mediaId_decidedAt_idx" ON "SubilafotoModerationDecision"("mediaId", "decidedAt");

-- CreateIndex
CREATE INDEX "SubilafotoModerationDecision_decision_decidedAt_idx" ON "SubilafotoModerationDecision"("decision", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoGuestSession_token_key" ON "SubilafotoGuestSession"("token");

-- CreateIndex
CREATE INDEX "SubilafotoGuestSession_eventId_lastSeenAt_idx" ON "SubilafotoGuestSession"("eventId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoScreen_pairingCode_key" ON "SubilafotoScreen"("pairingCode");

-- CreateIndex
CREATE INDEX "SubilafotoScreen_eventId_idx" ON "SubilafotoScreen"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoAccessLink_token_key" ON "SubilafotoAccessLink"("token");

-- CreateIndex
CREATE INDEX "SubilafotoAccessLink_eventId_kind_idx" ON "SubilafotoAccessLink"("eventId", "kind");

-- CreateIndex
CREATE INDEX "SubilafotoCollaborator_eventId_role_idx" ON "SubilafotoCollaborator"("eventId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoCollaborator_eventId_userId_key" ON "SubilafotoCollaborator"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoEventVendor_invitationToken_key" ON "SubilafotoEventVendor"("invitationToken");

-- CreateIndex
CREATE INDEX "SubilafotoEventVendor_partnerId_idx" ON "SubilafotoEventVendor"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoEventVendor_eventId_partnerId_key" ON "SubilafotoEventVendor"("eventId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubilafotoPackage_downloadToken_key" ON "SubilafotoPackage"("downloadToken");

-- CreateIndex
CREATE INDEX "SubilafotoPackage_eventId_status_idx" ON "SubilafotoPackage"("eventId", "status");

-- CreateIndex
CREATE INDEX "SubilafotoConsent_eventId_kind_idx" ON "SubilafotoConsent"("eventId", "kind");

-- CreateIndex
CREATE INDEX "SubilafotoAudit_eventId_createdAt_idx" ON "SubilafotoAudit"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "SubilafotoAudit_action_createdAt_idx" ON "SubilafotoAudit"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "SubilafotoSellerProfile" ADD CONSTRAINT "SubilafotoSellerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoOrder" ADD CONSTRAINT "SubilafotoOrder_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SubilafotoSellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoOrder" ADD CONSTRAINT "SubilafotoOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoEvent" ADD CONSTRAINT "SubilafotoEvent_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SubilafotoSellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoEvent" ADD CONSTRAINT "SubilafotoEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SubilafotoTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoMedia" ADD CONSTRAINT "SubilafotoMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoMedia" ADD CONSTRAINT "SubilafotoMedia_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "SubilafotoGuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoMediaVariant" ADD CONSTRAINT "SubilafotoMediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "SubilafotoMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoModerationDecision" ADD CONSTRAINT "SubilafotoModerationDecision_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "SubilafotoMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoGuestSession" ADD CONSTRAINT "SubilafotoGuestSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoScreen" ADD CONSTRAINT "SubilafotoScreen_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoAccessLink" ADD CONSTRAINT "SubilafotoAccessLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoCollaborator" ADD CONSTRAINT "SubilafotoCollaborator_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoCollaborator" ADD CONSTRAINT "SubilafotoCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoEventVendor" ADD CONSTRAINT "SubilafotoEventVendor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoPackage" ADD CONSTRAINT "SubilafotoPackage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoConsent" ADD CONSTRAINT "SubilafotoConsent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubilafotoAudit" ADD CONSTRAINT "SubilafotoAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

