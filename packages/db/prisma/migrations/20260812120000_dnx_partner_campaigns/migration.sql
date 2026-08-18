-- DNX Partners ETAPA 08 — Campaigns, creatives, geo/context targeting, ad placements.

-- Click tracking placements (additive)
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'HOME_INLINE';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'GALLERY_INLINE';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'PHOTO_DETAIL';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'EVENT_PAGE';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'CARD_PROMO';
ALTER TYPE "DnxPartnerPlacement" ADD VALUE IF NOT EXISTS 'LOGO_MARQUEE';

CREATE TYPE "DnxPartnerCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "DnxPartnerCampaignGeoScope" AS ENUM ('GLOBAL', 'COUNTRY', 'PROVINCE', 'CITY', 'MULTI_CITY');
CREATE TYPE "DnxPartnerCampaignContextCategory" AS ENUM (
  'PHOTOGRAPHY', 'SPORTS', 'NATURE', 'TOURISM', 'CULTURE', 'EDUCATION', 'SCHOOL',
  'SOCIAL_EVENT', 'WEDDING', 'XV', 'NIGHTLIFE', 'NEWS', 'EVENT', 'OTHER'
);
CREATE TYPE "DnxPartnerCreativeFormat" AS ENUM (
  'LOGO', 'LOGO_MARQUEE', 'BANNER_HORIZONTAL', 'BANNER_COMPACT', 'BANNER_MOBILE',
  'CARD_PROMO', 'SQUARE', 'STORY_VERTICAL', 'VIDEO_HORIZONTAL', 'VIDEO_VERTICAL',
  'WELCOME_INTERSTITIAL', 'ARTICLE_INLINE', 'GALLERY_INLINE'
);
CREATE TYPE "DnxPartnerCreativeDeviceTarget" AS ENUM ('ALL', 'DESKTOP', 'MOBILE', 'TABLET');
CREATE TYPE "DnxPartnerCreativeStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "DnxPartnerAdRotationMode" AS ENUM ('STATIC', 'RANDOM', 'ROUND_ROBIN', 'MARQUEE');

CREATE TABLE "DnxPartnerCampaign" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "participationId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "application" "DnxPartnerApplication" NOT NULL,
  "status" "DnxPartnerCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 100,
  "destinationUrl" TEXT,
  "trackingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "geoScope" "DnxPartnerCampaignGeoScope" NOT NULL DEFAULT 'GLOBAL',
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "DnxPartnerCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerCampaignCreative" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "format" "DnxPartnerCreativeFormat" NOT NULL,
  "deviceTarget" "DnxPartnerCreativeDeviceTarget" NOT NULL DEFAULT 'ALL',
  "title" TEXT,
  "body" TEXT,
  "ctaText" TEXT,
  "destinationUrl" TEXT,
  "status" "DnxPartnerCreativeStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "DnxPartnerCampaignCreative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerCampaignGeoTarget" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "countryCode" VARCHAR(2),
  "province" VARCHAR(120),
  "city" VARCHAR(120),
  "include" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxPartnerCampaignGeoTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerCampaignContextTarget" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "category" "DnxPartnerCampaignContextCategory" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxPartnerCampaignContextTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerAdPlacement" (
  "id" TEXT NOT NULL,
  "application" "DnxPartnerApplication" NOT NULL,
  "placementKey" VARCHAR(80) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "allowedFormats" "DnxPartnerCreativeFormat"[],
  "deviceSupport" "DnxPartnerCreativeDeviceTarget" NOT NULL DEFAULT 'ALL',
  "maxItems" INTEGER NOT NULL DEFAULT 1,
  "rotationMode" "DnxPartnerAdRotationMode" NOT NULL DEFAULT 'STATIC',
  "trackingPlacement" "DnxPartnerPlacement" NOT NULL DEFAULT 'BANNER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPartnerAdPlacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerCampaignPlacement" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "adPlacementId" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPartnerCampaignPlacement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerCampaign_partnerId_status_idx" ON "DnxPartnerCampaign"("partnerId", "status");
CREATE INDEX "DnxPartnerCampaign_application_status_idx" ON "DnxPartnerCampaign"("application", "status");
CREATE INDEX "DnxPartnerCampaign_participationId_idx" ON "DnxPartnerCampaign"("participationId");
CREATE INDEX "DnxPartnerCampaign_status_startsAt_endsAt_idx" ON "DnxPartnerCampaign"("status", "startsAt", "endsAt");
CREATE INDEX "DnxPartnerCampaign_archivedAt_idx" ON "DnxPartnerCampaign"("archivedAt");

CREATE INDEX "DnxPartnerCampaignCreative_campaignId_status_idx" ON "DnxPartnerCampaignCreative"("campaignId", "status");
CREATE INDEX "DnxPartnerCampaignCreative_assetId_idx" ON "DnxPartnerCampaignCreative"("assetId");
CREATE INDEX "DnxPartnerCampaignCreative_format_deviceTarget_idx" ON "DnxPartnerCampaignCreative"("format", "deviceTarget");
CREATE INDEX "DnxPartnerCampaignCreative_archivedAt_idx" ON "DnxPartnerCampaignCreative"("archivedAt");

CREATE INDEX "DnxPartnerCampaignGeoTarget_campaignId_idx" ON "DnxPartnerCampaignGeoTarget"("campaignId");
CREATE INDEX "DnxPartnerCampaignGeoTarget_countryCode_province_city_idx" ON "DnxPartnerCampaignGeoTarget"("countryCode", "province", "city");

CREATE UNIQUE INDEX "DnxPartnerCampaignContextTarget_campaignId_category_key" ON "DnxPartnerCampaignContextTarget"("campaignId", "category");
CREATE INDEX "DnxPartnerCampaignContextTarget_category_idx" ON "DnxPartnerCampaignContextTarget"("category");

CREATE UNIQUE INDEX "DnxPartnerAdPlacement_application_placementKey_key" ON "DnxPartnerAdPlacement"("application", "placementKey");
CREATE INDEX "DnxPartnerAdPlacement_application_isActive_idx" ON "DnxPartnerAdPlacement"("application", "isActive");

CREATE UNIQUE INDEX "DnxPartnerCampaignPlacement_campaignId_adPlacementId_key" ON "DnxPartnerCampaignPlacement"("campaignId", "adPlacementId");
CREATE INDEX "DnxPartnerCampaignPlacement_adPlacementId_isActive_priority_idx" ON "DnxPartnerCampaignPlacement"("adPlacementId", "isActive", "priority");

ALTER TABLE "DnxPartnerCampaign" ADD CONSTRAINT "DnxPartnerCampaign_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerCampaign" ADD CONSTRAINT "DnxPartnerCampaign_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerCampaignCreative" ADD CONSTRAINT "DnxPartnerCampaignCreative_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerCampaignCreative" ADD CONSTRAINT "DnxPartnerCampaignCreative_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DnxPartnerAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerCampaignGeoTarget" ADD CONSTRAINT "DnxPartnerCampaignGeoTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerCampaignContextTarget" ADD CONSTRAINT "DnxPartnerCampaignContextTarget_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerCampaignPlacement" ADD CONSTRAINT "DnxPartnerCampaignPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerCampaignPlacement" ADD CONSTRAINT "DnxPartnerCampaignPlacement_adPlacementId_fkey" FOREIGN KEY ("adPlacementId") REFERENCES "DnxPartnerAdPlacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
