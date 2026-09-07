-- Recomendados: enlace propio de cada socio, vínculo con quien lo trajo y cuota bonificada.

CREATE TYPE "MembershipRecommendationBenefitStatus" AS ENUM ('PENDIENTE', 'APLICADA', 'ANULADA');

ALTER TABLE "Member" ADD COLUMN "recommendationCode" TEXT;
ALTER TABLE "Member" ADD COLUMN "recommendedByMemberId" TEXT;

ALTER TABLE "MembershipApplication" ADD COLUMN "recommenderMemberId" TEXT;

ALTER TABLE "MembershipDuesSettings" ADD COLUMN "recommendationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MembershipDuesSettings" ADD COLUMN "recommendationBenefitPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;

CREATE TABLE "MembershipRecommendationBenefit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "originMemberId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "status" "MembershipRecommendationBenefitStatus" NOT NULL DEFAULT 'PENDIENTE',
    "appliedChargeId" TEXT,
    "appliedAmountArs" DECIMAL(12,2),
    "appliedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" INTEGER,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipRecommendationBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Member_recommendationCode_key" ON "Member"("recommendationCode");
CREATE INDEX "Member_workspaceId_recommendedByMemberId_idx" ON "Member"("workspaceId", "recommendedByMemberId");
CREATE UNIQUE INDEX "MembershipRecommendationBenefit_originMemberId_key" ON "MembershipRecommendationBenefit"("originMemberId");
CREATE UNIQUE INDEX "MembershipRecommendationBenefit_appliedChargeId_key" ON "MembershipRecommendationBenefit"("appliedChargeId");
CREATE INDEX "MembershipRecommendationBenefit_workspaceId_status_idx" ON "MembershipRecommendationBenefit"("workspaceId", "status");
CREATE INDEX "MembershipRecommendationBenefit_memberId_createdAt_idx" ON "MembershipRecommendationBenefit"("memberId", "createdAt");

ALTER TABLE "Member" ADD CONSTRAINT "Member_recommendedByMemberId_fkey" FOREIGN KEY ("recommendedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_originMemberId_fkey" FOREIGN KEY ("originMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_appliedChargeId_fkey" FOREIGN KEY ("appliedChargeId") REFERENCES "MembershipCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipRecommendationBenefit" ADD CONSTRAINT "MembershipRecommendationBenefit_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
