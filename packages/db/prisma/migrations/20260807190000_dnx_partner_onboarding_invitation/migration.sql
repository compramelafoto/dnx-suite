-- Additive: DNX Partner public onboarding invitations + brand profile fields (Stage 05 Imp 03).
-- Does not alter existing logoUrl or destroy assets. Rollback: drop new columns/table/enums (manual).

CREATE TYPE "DnxPartnerOnboardingInvitationStatus" AS ENUM (
  'PENDING',
  'OPENED',
  'SUBMITTED',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE "DnxPartnerOnboardingReviewStatus" AS ENUM (
  'NONE',
  'PENDING_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED'
);

ALTER TABLE "DnxPartner"
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "provinceOrState" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;

ALTER TABLE "DnxPartnerContact"
  ADD COLUMN IF NOT EXISTS "emailIsPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phoneIsPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DnxPartnerOnboardingInvitation" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "participationId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "status" "DnxPartnerOnboardingInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewStatus" "DnxPartnerOnboardingReviewStatus" NOT NULL DEFAULT 'NONE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "draftJson" JSONB,
  "submissionJson" JSONB,
  "createdByUserId" INTEGER,
  "reviewedByUserId" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPartnerOnboardingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartnerOnboardingInvitation_tokenHash_key"
  ON "DnxPartnerOnboardingInvitation"("tokenHash");

CREATE INDEX "DnxPartnerOnboardingInvitation_partnerId_status_idx"
  ON "DnxPartnerOnboardingInvitation"("partnerId", "status");

CREATE INDEX "DnxPartnerOnboardingInvitation_participationId_idx"
  ON "DnxPartnerOnboardingInvitation"("participationId");

CREATE INDEX "DnxPartnerOnboardingInvitation_expiresAt_idx"
  ON "DnxPartnerOnboardingInvitation"("expiresAt");

CREATE INDEX "DnxPartnerOnboardingInvitation_reviewStatus_idx"
  ON "DnxPartnerOnboardingInvitation"("reviewStatus");

ALTER TABLE "DnxPartnerOnboardingInvitation"
  ADD CONSTRAINT "DnxPartnerOnboardingInvitation_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DnxPartner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DnxPartnerOnboardingInvitation"
  ADD CONSTRAINT "DnxPartnerOnboardingInvitation_participationId_fkey"
  FOREIGN KEY ("participationId") REFERENCES "DnxPartnerParticipation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
