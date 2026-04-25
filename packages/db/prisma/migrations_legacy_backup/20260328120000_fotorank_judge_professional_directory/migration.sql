-- FotoRank: perfil profesional de jurado (directorio opt-in) + invitaciones desde directorio

CREATE TYPE "FotorankJudgeCompensationMode" AS ENUM ('VOLUNTEER', 'PAID', 'BOTH');
CREATE TYPE "FotorankJudgePricingMode" AS ENUM ('FIXED', 'STARTING_AT', 'NEGOTIABLE', 'NOT_SHOWN');
CREATE TYPE "FotorankJudgePriceUnit" AS ENUM ('PER_CONTEST', 'PER_CATEGORY', 'PER_HOUR', 'CUSTOM');
CREATE TYPE "FotorankJudgeDirectoryInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

ALTER TABLE "FotorankJudgeProfile" ADD COLUMN "displayNameOverride" TEXT,
ADD COLUMN "professionalHeadline" TEXT,
ADD COLUMN "specialtiesJson" JSONB,
ADD COLUMN "experienceYears" INTEGER,
ADD COLUMN "languagesJson" JSONB,
ADD COLUMN "region" TEXT,
ADD COLUMN "portfolioUrl" TEXT,
ADD COLUMN "isAvailableForJuryWork" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "availabilityNotes" TEXT,
ADD COLUMN "availableRemote" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "availableInPerson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferredContestScopes" TEXT,
ADD COLUMN "compensationMode" "FotorankJudgeCompensationMode" NOT NULL DEFAULT 'VOLUNTEER',
ADD COLUMN "pricingMode" "FotorankJudgePricingMode" NOT NULL DEFAULT 'NOT_SHOWN',
ADD COLUMN "priceAmount" DOUBLE PRECISION,
ADD COLUMN "priceCurrency" TEXT,
ADD COLUMN "priceNotes" TEXT,
ADD COLUMN "priceUnit" "FotorankJudgePriceUnit",
ADD COLUMN "isListedInProfessionalDirectory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showPricingPublicly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showLocationPublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showWebsitePublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showInstagramPublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isVerifiedByPlatform" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "completedJuryAssignmentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "responseRate" DOUBLE PRECISION,
ADD COLUMN "avgResponseTimeHours" DOUBLE PRECISION,
ADD COLUMN "completionScore" DOUBLE PRECISION,
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

CREATE INDEX "FotorankJudgeProfile_isListedInProfessionalDirectory_idx" ON "FotorankJudgeProfile"("isListedInProfessionalDirectory");

CREATE TABLE "FotorankJudgeDirectoryInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "sentByUserId" TEXT NOT NULL,
    "status" "FotorankJudgeDirectoryInviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "proposedRoleLabel" TEXT,
    "compensationOfferedText" TEXT,
    "organizerAcceptedExternalPaymentDisclaimer" BOOLEAN NOT NULL DEFAULT false,
    "categoryIdsJson" JSONB NOT NULL,
    "methodType" "FotorankJudgeMethodType" NOT NULL,
    "methodConfigJson" JSONB NOT NULL,
    "assignmentType" "FotorankJudgeAssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeDirectoryInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankJudgeDirectoryInvitation_organizationId_status_idx" ON "FotorankJudgeDirectoryInvitation"("organizationId", "status");
CREATE INDEX "FotorankJudgeDirectoryInvitation_contestId_judgeAccountId_idx" ON "FotorankJudgeDirectoryInvitation"("contestId", "judgeAccountId");
CREATE INDEX "FotorankJudgeDirectoryInvitation_judgeAccountId_status_idx" ON "FotorankJudgeDirectoryInvitation"("judgeAccountId", "status");

CREATE UNIQUE INDEX "FotorankJudgeDirectoryInvitation_contest_judge_active_key"
ON "FotorankJudgeDirectoryInvitation" ("contestId", "judgeAccountId")
WHERE "status" IN ('PENDING', 'ACCEPTED');

ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJudgeDirectoryInvitation" ADD CONSTRAINT "FotorankJudgeDirectoryInvitation_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
