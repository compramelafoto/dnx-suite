-- FotoRank P0-09A: motor estructurado de reglas / configuración versionada.
-- Aplicar solo en DB local/staging aislada (nunca Neon productiva).

CREATE TYPE "FotorankConfigVersionStatus" AS ENUM (
  'DRAFT',
  'READY_FOR_REVIEW',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TABLE "FotorankContestConfigurationVersion" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "FotorankConfigVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "configurationJson" JSONB NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "officialName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "pricingMode" "FotorankRegistrationPricingMode" NOT NULL,
    "priceAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "platformFeeBps" INTEGER NOT NULL DEFAULT 0,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAtExclusive" TIMESTAMP(3),
    "submissionOpensAt" TIMESTAMP(3),
    "submissionClosesAtExclusive" TIMESTAMP(3),
    "maxEntriesPerRegistration" INTEGER NOT NULL DEFAULT 1,
    "maxCategoriesPerRegistration" INTEGER NOT NULL DEFAULT 1,
    "allowReplace" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FotorankContestConfigurationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FotorankContestRulesTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'provincial',
    "configurationJson" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestRulesTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FotorankContestRulesVersion"
ADD COLUMN "configurationVersionId" TEXT;

ALTER TABLE "FotorankContestRegistration"
ADD COLUMN "configurationVersionId" TEXT;

CREATE UNIQUE INDEX "FotorankContestConfigurationVersion_contestId_versionNumber_key"
ON "FotorankContestConfigurationVersion"("contestId", "versionNumber");

CREATE INDEX "FotorankContestConfigurationVersion_contestId_status_idx"
ON "FotorankContestConfigurationVersion"("contestId", "status");

CREATE INDEX "FotorankContestConfigurationVersion_configurationHash_idx"
ON "FotorankContestConfigurationVersion"("configurationHash");

CREATE INDEX "FotorankContestConfigurationVersion_createdByUserId_idx"
ON "FotorankContestConfigurationVersion"("createdByUserId");

CREATE UNIQUE INDEX "FotorankContestRulesTemplate_slug_key"
ON "FotorankContestRulesTemplate"("slug");

CREATE INDEX "FotorankContestRulesTemplate_isActive_category_idx"
ON "FotorankContestRulesTemplate"("isActive", "category");

CREATE INDEX "FotorankContestRulesTemplate_createdByUserId_idx"
ON "FotorankContestRulesTemplate"("createdByUserId");

CREATE INDEX "FotorankContestRulesVersion_configurationVersionId_idx"
ON "FotorankContestRulesVersion"("configurationVersionId");

CREATE INDEX "FotorankContestRegistration_configurationVersionId_idx"
ON "FotorankContestRegistration"("configurationVersionId");

ALTER TABLE "FotorankContestConfigurationVersion"
ADD CONSTRAINT "FotorankContestConfigurationVersion_contestId_fkey"
FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankContestConfigurationVersion"
ADD CONSTRAINT "FotorankContestConfigurationVersion_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRulesTemplate"
ADD CONSTRAINT "FotorankContestRulesTemplate_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRulesVersion"
ADD CONSTRAINT "FotorankContestRulesVersion_configurationVersionId_fkey"
FOREIGN KEY ("configurationVersionId") REFERENCES "FotorankContestConfigurationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRegistration"
ADD CONSTRAINT "FotorankContestRegistration_configurationVersionId_fkey"
FOREIGN KEY ("configurationVersionId") REFERENCES "FotorankContestConfigurationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
