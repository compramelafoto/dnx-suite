-- DNX Financial Identity + Economic Agreements (Etapa 10D3I-C).
-- Additive only: CREATE TYPE / TABLE / INDEX / CONSTRAINT.
-- No DROP, TRUNCATE, DELETE, or mutation of User.mp* / Lab.mp*.
-- Do NOT apply to Production without explicit authorization.
-- Staging documentado histórico: ep-round-fog*. No asumir host del .env local.

-- Enums
CREATE TYPE "DnxFinancialSubjectType" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "DnxFinancialIdentityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "DnxFinancialEnvironment" AS ENUM ('TEST', 'PROD');
CREATE TYPE "DnxPaymentAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'NEEDS_REAUTH', 'REVOKED', 'DISABLED');
CREATE TYPE "DnxPaymentAccountCapability" AS ENUM ('COLLECTOR', 'SPLIT_RECEIVER', 'PAYOUT_DESTINATION');
CREATE TYPE "DnxEconomicAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'CLOSED', 'SUSPENDED');
CREATE TYPE "DnxAgreementParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'ACTIVE', 'PAUSED', 'EXITED', 'REMOVED');
CREATE TYPE "DnxAgreementParticipantRoleLabel" AS ENUM (
  'PARTNER',
  'VENUE_ORGANIZER',
  'SPONSOR_SCOUT',
  'SPONSOR',
  'PLATFORM',
  'PHOTOGRAPHER',
  'ORGANIZER',
  'OTHER'
);
CREATE TYPE "DnxDistributionVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "DnxDistributionRuleKind" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "DnxFinanceCapability" AS ENUM (
  'DNX_FINANCE_OWNER',
  'DNX_FINANCE_ADMIN',
  'PRODUCT_FINANCE_MANAGER',
  'PRODUCT_FINANCE_VIEWER'
);
CREATE TYPE "DnxFinanceGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- FinancialIdentity
CREATE TABLE "DnxFinancialIdentity" (
    "id" TEXT NOT NULL,
    "subjectType" "DnxFinancialSubjectType" NOT NULL,
    "ownerUserId" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "legalName" TEXT,
    "taxId" TEXT,
    "countryCode" TEXT NOT NULL,
    "status" "DnxFinancialIdentityStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxFinancialIdentity_pkey" PRIMARY KEY ("id")
);

-- PaymentAccount
CREATE TABLE "DnxPaymentAccount" (
    "id" TEXT NOT NULL,
    "financialIdentityId" TEXT NOT NULL,
    "provider" "DnxPaymentProvider" NOT NULL,
    "environment" "DnxFinancialEnvironment" NOT NULL,
    "providerUserId" TEXT,
    "externalReference" TEXT,
    "credentialReference" TEXT,
    "consentReference" TEXT,
    "originApp" TEXT,
    "capabilities" "DnxPaymentAccountCapability"[] DEFAULT ARRAY[]::"DnxPaymentAccountCapability"[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "DnxPaymentAccountStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxPaymentAccount_pkey" PRIMARY KEY ("id")
);

-- EconomicAgreement (currentVersionId FK added after versions table)
CREATE TABLE "DnxEconomicAgreement" (
    "id" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "DnxEconomicAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxEconomicAgreement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxAgreementParticipant" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "financialIdentityId" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "roleLabel" "DnxAgreementParticipantRoleLabel" NOT NULL,
    "status" "DnxAgreementParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "invitedByUserId" INTEGER NOT NULL,
    "approvedByUserId" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxAgreementParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxDistributionVersion" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "DnxDistributionVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "roundingPolicy" TEXT NOT NULL DEFAULT 'LARGEST_REMAINDER',
    "feePolicy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" INTEGER,
    "supersedesVersionId" TEXT,
    "rulesHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxDistributionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxDistributionRule" (
    "id" TEXT NOT NULL,
    "distributionVersionId" TEXT NOT NULL,
    "agreementParticipantId" TEXT NOT NULL,
    "kind" "DnxDistributionRuleKind" NOT NULL,
    "value" BIGINT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxDistributionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxOrderDistributionSnapshot" (
    "id" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "agreementId" TEXT NOT NULL,
    "distributionVersionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "engineInputHash" TEXT NOT NULL,
    "publishedByUserId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "paymentIntentId" TEXT,
    "paymentOrderId" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxOrderDistributionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxFinancialIdentityRecipientLink" (
    "id" TEXT NOT NULL,
    "financialIdentityId" TEXT NOT NULL,
    "paymentRecipientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxFinancialIdentityRecipientLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxFinanceGrant" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "capability" "DnxFinanceCapability" NOT NULL,
    "productKey" TEXT,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "status" "DnxFinanceGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxFinanceGrant_pkey" PRIMARY KEY ("id")
);

-- Unique currentVersionId on agreement
CREATE UNIQUE INDEX "DnxEconomicAgreement_currentVersionId_key" ON "DnxEconomicAgreement"("currentVersionId");
CREATE UNIQUE INDEX "DnxEconomicAgreement_productKey_scopeType_scopeId_key" ON "DnxEconomicAgreement"("productKey", "scopeType", "scopeId");
CREATE UNIQUE INDEX "DnxAgreementParticipant_agreementId_financialIdentityId_key" ON "DnxAgreementParticipant"("agreementId", "financialIdentityId");
CREATE UNIQUE INDEX "DnxDistributionVersion_agreementId_versionNumber_key" ON "DnxDistributionVersion"("agreementId", "versionNumber");
CREATE UNIQUE INDEX "DnxDistributionRule_distributionVersionId_agreementParticipantId_key" ON "DnxDistributionRule"("distributionVersionId", "agreementParticipantId");
CREATE UNIQUE INDEX "DnxFinancialIdentityRecipientLink_financialIdentityId_paymentRecipientId_key" ON "DnxFinancialIdentityRecipientLink"("financialIdentityId", "paymentRecipientId");

-- Partial uniques (invariantes críticas)
CREATE UNIQUE INDEX "DnxFinancialIdentity_primary_person_active_uid"
  ON "DnxFinancialIdentity" ("ownerUserId")
  WHERE "subjectType" = 'PERSON'
    AND "isPrimary" = true
    AND "status" IN ('DRAFT', 'ACTIVE')
    AND "ownerUserId" IS NOT NULL;

CREATE UNIQUE INDEX "DnxPaymentAccount_provider_user_env_live_uid"
  ON "DnxPaymentAccount" ("provider", "providerUserId", "environment")
  WHERE "providerUserId" IS NOT NULL
    AND "status" IN ('PENDING', 'ACTIVE', 'NEEDS_REAUTH');

-- FKs
ALTER TABLE "DnxFinancialIdentity"
  ADD CONSTRAINT "DnxFinancialIdentity_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxPaymentAccount"
  ADD CONSTRAINT "DnxPaymentAccount_financialIdentityId_fkey"
  FOREIGN KEY ("financialIdentityId") REFERENCES "DnxFinancialIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxEconomicAgreement"
  ADD CONSTRAINT "DnxEconomicAgreement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxDistributionVersion"
  ADD CONSTRAINT "DnxDistributionVersion_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "DnxEconomicAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxDistributionVersion"
  ADD CONSTRAINT "DnxDistributionVersion_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxDistributionVersion"
  ADD CONSTRAINT "DnxDistributionVersion_supersedesVersionId_fkey"
  FOREIGN KEY ("supersedesVersionId") REFERENCES "DnxDistributionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxEconomicAgreement"
  ADD CONSTRAINT "DnxEconomicAgreement_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "DnxDistributionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxAgreementParticipant"
  ADD CONSTRAINT "DnxAgreementParticipant_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "DnxEconomicAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxAgreementParticipant"
  ADD CONSTRAINT "DnxAgreementParticipant_financialIdentityId_fkey"
  FOREIGN KEY ("financialIdentityId") REFERENCES "DnxFinancialIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxAgreementParticipant"
  ADD CONSTRAINT "DnxAgreementParticipant_paymentAccountId_fkey"
  FOREIGN KEY ("paymentAccountId") REFERENCES "DnxPaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxAgreementParticipant"
  ADD CONSTRAINT "DnxAgreementParticipant_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxAgreementParticipant"
  ADD CONSTRAINT "DnxAgreementParticipant_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxDistributionRule"
  ADD CONSTRAINT "DnxDistributionRule_distributionVersionId_fkey"
  FOREIGN KEY ("distributionVersionId") REFERENCES "DnxDistributionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxDistributionRule"
  ADD CONSTRAINT "DnxDistributionRule_agreementParticipantId_fkey"
  FOREIGN KEY ("agreementParticipantId") REFERENCES "DnxAgreementParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxOrderDistributionSnapshot"
  ADD CONSTRAINT "DnxOrderDistributionSnapshot_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "DnxEconomicAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxOrderDistributionSnapshot"
  ADD CONSTRAINT "DnxOrderDistributionSnapshot_distributionVersionId_fkey"
  FOREIGN KEY ("distributionVersionId") REFERENCES "DnxDistributionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxFinancialIdentityRecipientLink"
  ADD CONSTRAINT "DnxFinancialIdentityRecipientLink_financialIdentityId_fkey"
  FOREIGN KEY ("financialIdentityId") REFERENCES "DnxFinancialIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxFinanceGrant"
  ADD CONSTRAINT "DnxFinanceGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxFinanceGrant"
  ADD CONSTRAINT "DnxFinanceGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "DnxFinancialIdentity_ownerUserId_subjectType_status_idx" ON "DnxFinancialIdentity"("ownerUserId", "subjectType", "status");
CREATE INDEX "DnxFinancialIdentity_status_idx" ON "DnxFinancialIdentity"("status");
CREATE INDEX "DnxPaymentAccount_financialIdentityId_status_idx" ON "DnxPaymentAccount"("financialIdentityId", "status");
CREATE INDEX "DnxPaymentAccount_provider_environment_providerUserId_idx" ON "DnxPaymentAccount"("provider", "environment", "providerUserId");
CREATE INDEX "DnxPaymentAccount_status_idx" ON "DnxPaymentAccount"("status");
CREATE INDEX "DnxEconomicAgreement_productKey_status_idx" ON "DnxEconomicAgreement"("productKey", "status");
CREATE INDEX "DnxEconomicAgreement_createdByUserId_idx" ON "DnxEconomicAgreement"("createdByUserId");
CREATE INDEX "DnxAgreementParticipant_financialIdentityId_status_idx" ON "DnxAgreementParticipant"("financialIdentityId", "status");
CREATE INDEX "DnxAgreementParticipant_agreementId_status_idx" ON "DnxAgreementParticipant"("agreementId", "status");
CREATE INDEX "DnxDistributionVersion_agreementId_status_idx" ON "DnxDistributionVersion"("agreementId", "status");
CREATE INDEX "DnxDistributionRule_distributionVersionId_idx" ON "DnxDistributionRule"("distributionVersionId");
CREATE INDEX "DnxOrderDistributionSnapshot_agreementId_versionNumber_idx" ON "DnxOrderDistributionSnapshot"("agreementId", "versionNumber");
CREATE INDEX "DnxOrderDistributionSnapshot_paymentIntentId_idx" ON "DnxOrderDistributionSnapshot"("paymentIntentId");
CREATE INDEX "DnxOrderDistributionSnapshot_paymentOrderId_idx" ON "DnxOrderDistributionSnapshot"("paymentOrderId");
CREATE INDEX "DnxOrderDistributionSnapshot_productKey_externalReference_idx" ON "DnxOrderDistributionSnapshot"("productKey", "externalReference");
CREATE INDEX "DnxOrderDistributionSnapshot_engineInputHash_idx" ON "DnxOrderDistributionSnapshot"("engineInputHash");
CREATE INDEX "DnxFinancialIdentityRecipientLink_paymentRecipientId_idx" ON "DnxFinancialIdentityRecipientLink"("paymentRecipientId");
CREATE INDEX "DnxFinanceGrant_userId_status_idx" ON "DnxFinanceGrant"("userId", "status");
CREATE INDEX "DnxFinanceGrant_capability_productKey_status_idx" ON "DnxFinanceGrant"("capability", "productKey", "status");
CREATE INDEX "DnxFinanceGrant_productKey_scopeType_scopeId_idx" ON "DnxFinanceGrant"("productKey", "scopeType", "scopeId");
