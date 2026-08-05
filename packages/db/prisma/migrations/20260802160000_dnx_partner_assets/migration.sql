-- Additive: DNX Partners brand + participation assets (Stage 01 Imp 02).
-- Does not drop or alter logoUrl. Rollback: drop new tables/enums/capability values (manual).

ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_VIEW';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_UPLOAD';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_UPDATE';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_ARCHIVE';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_APPROVE';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_MANAGE_BRAND';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_ASSETS_MANAGE_PARTICIPATION';

CREATE TYPE "DnxPartnerBrandAssetType" AS ENUM (
  'LOGO_PRIMARY', 'LOGO_HORIZONTAL', 'LOGO_VERTICAL', 'LOGO_LIGHT', 'LOGO_DARK',
  'LOGO_MONOCHROME', 'ISOTYPE', 'ICON', 'BRAND_GUIDELINES', 'BRAND_PHOTO', 'DOCUMENT', 'OTHER'
);

CREATE TYPE "DnxPartnerAssetBackground" AS ENUM ('TRANSPARENT', 'LIGHT', 'DARK', 'COLOR', 'UNKNOWN');
CREATE TYPE "DnxPartnerAssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "DnxPartnerAssetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

CREATE TYPE "DnxPartnerMaterialChannel" AS ENUM (
  'WEB', 'MOBILE', 'INSTAGRAM_POST', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL',
  'FACEBOOK_POST', 'FACEBOOK_STORY', 'LINKEDIN_POST', 'EMAIL', 'NEWSLETTER',
  'PUSH_NOTIFICATION', 'DIGITAL_SCREEN', 'PRINT', 'CREDENTIAL', 'EVENT_SIGNAGE', 'STORE', 'OTHER'
);

CREATE TYPE "DnxPartnerMaterialType" AS ENUM (
  'LOGO', 'IMAGE', 'VIDEO', 'BANNER', 'COVER', 'THUMBNAIL', 'POST', 'STORY', 'REEL',
  'FLYER', 'COUPON', 'VOUCHER', 'PRODUCT_IMAGE', 'PRIZE_IMAGE', 'BENEFIT_IMAGE',
  'DOCUMENT', 'AUDIO', 'OTHER'
);

CREATE TYPE "DnxPartnerMaterialPurpose" AS ENUM (
  'BRANDING', 'SPONSOR_VISIBILITY', 'BENEFIT_PROMOTION', 'PRIZE_PROMOTION',
  'EVENT_PROMOTION', 'SOCIAL_PUBLICATION', 'EMAIL_CONTENT', 'WEBSITE_CONTENT',
  'PRINT_CONTENT', 'INTERNAL_REFERENCE', 'OTHER'
);

CREATE TYPE "DnxPartnerAssetOrientation" AS ENUM (
  'SQUARE', 'PORTRAIT', 'LANDSCAPE', 'VERTICAL', 'HORIZONTAL', 'FREE', 'UNKNOWN'
);

CREATE TYPE "DnxPartnerStorageProvider" AS ENUM ('R2', 'LOCAL', 'INLINE', 'EXTERNAL');

CREATE TABLE "DnxPartnerAsset" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "DnxPartnerBrandAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storageProvider" "DnxPartnerStorageProvider" NOT NULL DEFAULT 'R2',
    "storageKey" TEXT,
    "fileUrl" TEXT,
    "mediaAssetId" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileExtension" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "aspectRatio" TEXT,
    "backgroundType" "DnxPartnerAssetBackground" NOT NULL DEFAULT 'UNKNOWN',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "DnxPartnerAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "DnxPartnerAssetApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "altText" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "uploadedById" INTEGER,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerAsset_partnerId_type_idx" ON "DnxPartnerAsset"("partnerId", "type");
CREATE INDEX "DnxPartnerAsset_partnerId_status_approvalStatus_idx" ON "DnxPartnerAsset"("partnerId", "status", "approvalStatus");
CREATE INDEX "DnxPartnerAsset_partnerId_isPrimary_idx" ON "DnxPartnerAsset"("partnerId", "isPrimary");
CREATE INDEX "DnxPartnerAsset_status_approvalStatus_idx" ON "DnxPartnerAsset"("status", "approvalStatus");
CREATE INDEX "DnxPartnerAsset_archivedAt_idx" ON "DnxPartnerAsset"("archivedAt");

ALTER TABLE "DnxPartnerAsset" ADD CONSTRAINT "DnxPartnerAsset_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DnxPartnerParticipationAsset" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "benefitId" TEXT,
    "contributionId" TEXT,
    "prizeBundleId" TEXT,
    "application" "DnxPartnerApplication" NOT NULL DEFAULT 'CLICKATON',
    "channel" "DnxPartnerMaterialChannel" NOT NULL DEFAULT 'WEB',
    "assetType" "DnxPartnerMaterialType" NOT NULL DEFAULT 'IMAGE',
    "purpose" "DnxPartnerMaterialPurpose" NOT NULL DEFAULT 'SPONSOR_VISIBILITY',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storageProvider" "DnxPartnerStorageProvider" NOT NULL DEFAULT 'R2',
    "storageKey" TEXT,
    "fileUrl" TEXT,
    "mediaAssetId" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileExtension" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "aspectRatio" TEXT,
    "orientation" "DnxPartnerAssetOrientation" NOT NULL DEFAULT 'UNKNOWN',
    "status" "DnxPartnerAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "DnxPartnerAssetApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "altText" TEXT,
    "caption" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "uploadedById" INTEGER,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerParticipationAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerParticipationAsset_participationId_status_approvalStatus_idx"
  ON "DnxPartnerParticipationAsset"("participationId", "status", "approvalStatus");
CREATE INDEX "DnxPartnerParticipationAsset_benefitId_idx" ON "DnxPartnerParticipationAsset"("benefitId");
CREATE INDEX "DnxPartnerParticipationAsset_contributionId_idx" ON "DnxPartnerParticipationAsset"("contributionId");
CREATE INDEX "DnxPartnerParticipationAsset_prizeBundleId_idx" ON "DnxPartnerParticipationAsset"("prizeBundleId");
CREATE INDEX "DnxPartnerParticipationAsset_application_channel_idx" ON "DnxPartnerParticipationAsset"("application", "channel");
CREATE INDEX "DnxPartnerParticipationAsset_assetType_purpose_idx" ON "DnxPartnerParticipationAsset"("assetType", "purpose");
CREATE INDEX "DnxPartnerParticipationAsset_status_approvalStatus_idx" ON "DnxPartnerParticipationAsset"("status", "approvalStatus");
CREATE INDEX "DnxPartnerParticipationAsset_startsAt_endsAt_idx" ON "DnxPartnerParticipationAsset"("startsAt", "endsAt");

ALTER TABLE "DnxPartnerParticipationAsset" ADD CONSTRAINT "DnxPartnerParticipationAsset_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerParticipationAsset" ADD CONSTRAINT "DnxPartnerParticipationAsset_benefitId_fkey"
  FOREIGN KEY ("benefitId") REFERENCES "DnxPartnerBenefit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerParticipationAsset" ADD CONSTRAINT "DnxPartnerParticipationAsset_contributionId_fkey"
  FOREIGN KEY ("contributionId") REFERENCES "DnxPartnerContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
