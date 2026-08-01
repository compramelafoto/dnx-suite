-- Additive: manual benefit access + prizeBundleId index + grant capability.
-- DnxPartnerGrant remains RBAC capabilities (unchanged).

ALTER TYPE "DnxPartnerCapability" ADD VALUE 'PARTNER_BENEFITS_GRANT';

CREATE TYPE "DnxPartnerBenefitAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "DnxPartnerBenefitAccess" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "DnxPartnerBenefitAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT DEFAULT 'MANUAL',
    "notes" TEXT,
    "grantedByUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DnxPartnerBenefitAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartnerBenefitAccess_benefitId_userId_key" ON "DnxPartnerBenefitAccess"("benefitId", "userId");
CREATE INDEX "DnxPartnerBenefitAccess_userId_status_idx" ON "DnxPartnerBenefitAccess"("userId", "status");
CREATE INDEX "DnxPartnerBenefitAccess_benefitId_status_idx" ON "DnxPartnerBenefitAccess"("benefitId", "status");

ALTER TABLE "DnxPartnerBenefitAccess" ADD CONSTRAINT "DnxPartnerBenefitAccess_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "DnxPartnerBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DnxPartnerContribution_prizeBundleId_idx" ON "DnxPartnerContribution"("prizeBundleId");
