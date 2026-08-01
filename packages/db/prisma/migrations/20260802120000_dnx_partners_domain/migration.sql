-- DNX Partners domain (Etapa 01) — additive only.
-- Commercial partners / sponsors / benefits. Not Mercado Pago finance partners.
-- No backfill. Safe to apply on empty or existing DBs.

CREATE TYPE "DnxPartnerType" AS ENUM ('COMPANY', 'BUSINESS', 'BRAND', 'INSTITUTION', 'ORGANIZATION', 'PERSON', 'GOVERNMENT', 'OTHER');
CREATE TYPE "DnxPartnerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "DnxPartnerApplication" AS ENUM ('DNX_SUITE', 'CLICKATON', 'FOTO_OFFICE', 'FOTO_RANK', 'COMPRAME_LA_FOTO', 'INFO_SPOT', 'OTHER');
CREATE TYPE "DnxPartnerContextType" AS ENUM ('GLOBAL', 'ORGANIZATION', 'EVENT', 'EDITION', 'VENUE', 'CONTEST', 'CATEGORY', 'ALBUM', 'MEMBERSHIP', 'CAMPAIGN', 'PLATFORM', 'OTHER');
CREATE TYPE "DnxPartnerParticipationType" AS ENUM ('SPONSOR', 'BENEFIT_PROVIDER', 'PRIZE_PROVIDER', 'SERVICE_PROVIDER', 'INSTITUTIONAL_PARTNER', 'MEDIA_PARTNER', 'COMMERCIAL_PARTNER', 'COLLABORATOR', 'OTHER');
CREATE TYPE "DnxPartnerParticipationStatus" AS ENUM ('DRAFT', 'PROPOSED', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "DnxPartnerPaymentMode" AS ENUM ('NONE', 'ONE_TIME', 'INSTALLMENTS', 'RECURRING', 'MANUAL', 'EXTERNAL');
CREATE TYPE "DnxPartnerContributionType" AS ENUM ('MONEY', 'PRODUCT', 'PRIZE', 'VOUCHER', 'DISCOUNT', 'SERVICE', 'EQUIPMENT', 'PROMOTION', 'CONTENT', 'INSTITUTIONAL_SUPPORT', 'VENUE', 'LOGISTICS', 'OTHER');
CREATE TYPE "DnxPartnerContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "DnxPartnerBenefitType" AS ENUM ('PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'PROMO_CODE', 'FREE_SERVICE', 'FREE_PRODUCT', 'VOUCHER', 'PRIORITY_SERVICE', 'SPECIAL_PRICE', 'UPGRADE', 'OTHER');
CREATE TYPE "DnxPartnerRedemptionMethod" AS ENUM ('PROMO_CODE', 'DIGITAL_CREDENTIAL', 'PHYSICAL_CREDENTIAL', 'IDENTITY_VERIFICATION', 'MANUAL_APPROVAL', 'EXTERNAL_LINK', 'CONTACT_PARTNER', 'OTHER');
CREATE TYPE "DnxPartnerBenefitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "DnxPartnerAudienceType" AS ENUM ('ALL_USERS', 'ORGANIZATION_MEMBERS', 'EVENT_PARTICIPANTS', 'EDITION_PARTICIPANTS', 'PRODUCT_PURCHASERS', 'MEMBERSHIP_HOLDERS', 'MANUAL_USERS', 'CUSTOM_GROUP', 'OTHER');
CREATE TYPE "DnxPartnerCapability" AS ENUM ('PARTNER_VIEW', 'PARTNER_CREATE', 'PARTNER_UPDATE', 'PARTNER_ARCHIVE', 'PARTNER_PARTICIPATIONS_MANAGE', 'PARTNER_CONTRIBUTIONS_MANAGE', 'PARTNER_BENEFITS_VIEW', 'PARTNER_BENEFITS_MANAGE', 'PARTNER_BENEFITS_PUBLISH', 'PARTNER_PAYMENTS_VIEW', 'PARTNER_PAYMENTS_MANAGE', 'PARTNER_CONTACT_SENSITIVE');
CREATE TYPE "DnxPartnerGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "DnxPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "DnxPartnerType" NOT NULL DEFAULT 'COMPANY',
    "status" "DnxPartnerStatus" NOT NULL DEFAULT 'PROSPECT',
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "instagram" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "financialIdentityId" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerContact" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "roleTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerParticipation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "application" "DnxPartnerApplication" NOT NULL,
    "contextType" "DnxPartnerContextType" NOT NULL DEFAULT 'GLOBAL',
    "contextId" TEXT,
    "participationType" "DnxPartnerParticipationType" NOT NULL DEFAULT 'SPONSOR',
    "title" TEXT,
    "description" TEXT,
    "status" "DnxPartnerParticipationStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "requiresPayment" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" "DnxPartnerPaymentMode" NOT NULL DEFAULT 'NONE',
    "paymentAmountMinor" INTEGER,
    "paymentCurrency" TEXT DEFAULT 'ARS',
    "paymentNotes" TEXT,
    "estimatedValueMinor" INTEGER,
    "currency" TEXT DEFAULT 'ARS',
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerParticipation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerContribution" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "type" "DnxPartnerContributionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER,
    "estimatedUnitValueMinor" INTEGER,
    "estimatedTotalValueMinor" INTEGER,
    "currency" TEXT DEFAULT 'ARS',
    "status" "DnxPartnerContributionStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "promotionId" TEXT,
    "prizeBundleId" TEXT,
    "externalCode" TEXT,
    "notes" TEXT,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DnxPartnerContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerBenefit" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "participationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "benefitType" "DnxPartnerBenefitType" NOT NULL,
    "status" "DnxPartnerBenefitStatus" NOT NULL DEFAULT 'DRAFT',
    "discountPercentage" INTEGER,
    "discountAmountMinor" INTEGER,
    "currency" TEXT DEFAULT 'ARS',
    "promoCode" TEXT,
    "promotionId" TEXT,
    "redemptionMethod" "DnxPartnerRedemptionMethod" NOT NULL DEFAULT 'CONTACT_PARTNER',
    "redemptionInstructions" TEXT,
    "terms" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "totalRedemptionLimit" INTEGER,
    "perUserRedemptionLimit" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerBenefit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerBenefitAudience" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "audienceType" "DnxPartnerAudienceType" NOT NULL,
    "organizationId" TEXT,
    "contextType" "DnxPartnerContextType",
    "contextId" TEXT,
    "manualUserId" INTEGER,
    "label" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DnxPartnerBenefitAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerGrant" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "capability" "DnxPartnerCapability" NOT NULL,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "status" "DnxPartnerGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "DnxPartnerGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPartnerAuditEvent" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "summary" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DnxPartnerAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartner_slug_key" ON "DnxPartner"("slug");
CREATE INDEX "DnxPartner_status_updatedAt_idx" ON "DnxPartner"("status", "updatedAt");
CREATE INDEX "DnxPartner_type_status_idx" ON "DnxPartner"("type", "status");
CREATE INDEX "DnxPartner_name_idx" ON "DnxPartner"("name");

CREATE INDEX "DnxPartnerContact_partnerId_isPrimary_idx" ON "DnxPartnerContact"("partnerId", "isPrimary");

CREATE INDEX "DnxPartnerParticipation_partnerId_status_idx" ON "DnxPartnerParticipation"("partnerId", "status");
CREATE INDEX "DnxPartnerParticipation_application_status_idx" ON "DnxPartnerParticipation"("application", "status");
CREATE INDEX "DnxPartnerParticipation_contextType_contextId_idx" ON "DnxPartnerParticipation"("contextType", "contextId");
CREATE INDEX "DnxPartnerParticipation_organizationId_idx" ON "DnxPartnerParticipation"("organizationId");

CREATE INDEX "DnxPartnerContribution_participationId_status_idx" ON "DnxPartnerContribution"("participationId", "status");
CREATE INDEX "DnxPartnerContribution_type_status_idx" ON "DnxPartnerContribution"("type", "status");

CREATE INDEX "DnxPartnerBenefit_partnerId_status_idx" ON "DnxPartnerBenefit"("partnerId", "status");
CREATE INDEX "DnxPartnerBenefit_participationId_idx" ON "DnxPartnerBenefit"("participationId");
CREATE INDEX "DnxPartnerBenefit_status_startsAt_endsAt_idx" ON "DnxPartnerBenefit"("status", "startsAt", "endsAt");
CREATE INDEX "DnxPartnerBenefit_promoCode_idx" ON "DnxPartnerBenefit"("promoCode");

CREATE INDEX "DnxPartnerBenefitAudience_benefitId_audienceType_idx" ON "DnxPartnerBenefitAudience"("benefitId", "audienceType");
CREATE INDEX "DnxPartnerBenefitAudience_organizationId_idx" ON "DnxPartnerBenefitAudience"("organizationId");
CREATE INDEX "DnxPartnerBenefitAudience_contextType_contextId_idx" ON "DnxPartnerBenefitAudience"("contextType", "contextId");

CREATE INDEX "DnxPartnerGrant_userId_status_idx" ON "DnxPartnerGrant"("userId", "status");
CREATE INDEX "DnxPartnerGrant_capability_status_idx" ON "DnxPartnerGrant"("capability", "status");
CREATE INDEX "DnxPartnerGrant_scopeType_scopeId_idx" ON "DnxPartnerGrant"("scopeType", "scopeId");

CREATE INDEX "DnxPartnerAuditEvent_partnerId_createdAt_idx" ON "DnxPartnerAuditEvent"("partnerId", "createdAt");
CREATE INDEX "DnxPartnerAuditEvent_entityType_entityId_idx" ON "DnxPartnerAuditEvent"("entityType", "entityId");
CREATE INDEX "DnxPartnerAuditEvent_action_createdAt_idx" ON "DnxPartnerAuditEvent"("action", "createdAt");

ALTER TABLE "DnxPartnerContact" ADD CONSTRAINT "DnxPartnerContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerParticipation" ADD CONSTRAINT "DnxPartnerParticipation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerContribution" ADD CONSTRAINT "DnxPartnerContribution_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerBenefit" ADD CONSTRAINT "DnxPartnerBenefit_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerBenefit" ADD CONSTRAINT "DnxPartnerBenefit_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerBenefitAudience" ADD CONSTRAINT "DnxPartnerBenefitAudience_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "DnxPartnerBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DnxPartnerAuditEvent" ADD CONSTRAINT "DnxPartnerAuditEvent_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
