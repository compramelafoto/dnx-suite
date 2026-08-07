-- Additive: benefit eligibility materialization (Stage 02 Imp 02).
-- Compatible with existing MANUAL access rows (reason='MANUAL').
-- Rollback: drop SyncRun; drop new columns/enums after restoring unique(benefitId,userId) if needed.

ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_VIEW_ELIGIBILITY';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_SYNC_ACCESS';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_REVOKE';
ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_VIEW_ACCESS';

ALTER TYPE "DnxPartnerBenefitAccessStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "DnxPartnerBenefitAccessStatus" ADD VALUE 'PENDING_IDENTITY';
ALTER TYPE "DnxPartnerBenefitAccessStatus" ADD VALUE 'SKIPPED';

CREATE TYPE "DnxPartnerBenefitAccessSource" AS ENUM ('MANUAL', 'AUTOMATIC');

ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "accessKey" TEXT;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "source" "DnxPartnerBenefitAccessSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "reasonCode" TEXT;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "revokedByUserId" INTEGER;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DnxPartnerBenefitAccess" ADD COLUMN "metadata" JSONB;

-- Backfill accessKey + reasonCode for existing rows
UPDATE "DnxPartnerBenefitAccess"
SET
  "accessKey" = 'manual:' || "benefitId" || ':' || "userId"::text,
  "source" = 'MANUAL',
  "sourceType" = 'ADMIN',
  "sourceId" = "id",
  "reasonCode" = COALESCE(NULLIF("reason", ''), 'MANUAL_GRANT'),
  "grantedAt" = COALESCE("grantedAt", "createdAt");

ALTER TABLE "DnxPartnerBenefitAccess" ALTER COLUMN "accessKey" SET NOT NULL;

DROP INDEX IF EXISTS "DnxPartnerBenefitAccess_benefitId_userId_key";
ALTER TABLE "DnxPartnerBenefitAccess" ALTER COLUMN "userId" DROP NOT NULL;

CREATE UNIQUE INDEX "DnxPartnerBenefitAccess_accessKey_key" ON "DnxPartnerBenefitAccess"("accessKey");
CREATE INDEX "DnxPartnerBenefitAccess_benefitId_source_status_idx" ON "DnxPartnerBenefitAccess"("benefitId", "source", "status");
CREATE INDEX "DnxPartnerBenefitAccess_sourceType_sourceId_idx" ON "DnxPartnerBenefitAccess"("sourceType", "sourceId");

CREATE TABLE "DnxPartnerBenefitSyncRun" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT,
    "editionId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "summaryJson" JSONB,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DnxPartnerBenefitSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DnxPartnerBenefitSyncRun_benefitId_status_startedAt_idx"
  ON "DnxPartnerBenefitSyncRun"("benefitId", "status", "startedAt");
CREATE INDEX "DnxPartnerBenefitSyncRun_editionId_status_startedAt_idx"
  ON "DnxPartnerBenefitSyncRun"("editionId", "status", "startedAt");
