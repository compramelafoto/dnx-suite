-- FotoRank P0-09B: ciclo de vida de bases, revisión, aceptación y menores.
-- Aplicar solo en DB local/staging aislada (nunca Neon productiva).

ALTER TYPE "FotorankRulesVersionStatus" ADD VALUE 'GENERATED';
ALTER TYPE "FotorankRulesVersionStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "FotorankRulesVersionStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "FotorankRulesVersionStatus" ADD VALUE 'APPROVED';

CREATE TYPE "FotorankRulesGeneratedBy" AS ENUM (
  'MANUAL',
  'EXTERNAL_AI',
  'OPENAI_API',
  'TEMPLATE'
);

CREATE TYPE "FotorankLegalReviewStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'REVIEWED',
  'CHANGES_REQUESTED'
);

ALTER TABLE "FotorankContestRulesVersion"
ADD COLUMN "configurationHashSnapshot" TEXT,
ADD COLUMN "generatedBy" "FotorankRulesGeneratedBy" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "generatedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" INTEGER,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "approvedByUserId" INTEGER,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "publishedByUserId" INTEGER,
ADD COLUMN "reviewNotes" TEXT,
ADD COLUMN "legalReviewStatus" "FotorankLegalReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "legalReviewNotes" TEXT,
ADD COLUMN "originalImportedContent" TEXT,
ADD COLUMN "contentFormat" TEXT NOT NULL DEFAULT 'markdown',
ADD COLUMN "structuredImportJson" JSONB,
ADD COLUMN "compareSnapshotJson" JSONB,
ADD COLUMN "sectionsChecklistJson" JSONB;

CREATE INDEX "FotorankContestRulesVersion_legalReviewStatus_idx"
ON "FotorankContestRulesVersion"("legalReviewStatus");

CREATE INDEX "FotorankContestRulesVersion_reviewedByUserId_idx"
ON "FotorankContestRulesVersion"("reviewedByUserId");

CREATE INDEX "FotorankContestRulesVersion_approvedByUserId_idx"
ON "FotorankContestRulesVersion"("approvedByUserId");

CREATE INDEX "FotorankContestRulesVersion_publishedByUserId_idx"
ON "FotorankContestRulesVersion"("publishedByUserId");

ALTER TABLE "FotorankContestRulesVersion"
ADD CONSTRAINT "FotorankContestRulesVersion_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRulesVersion"
ADD CONSTRAINT "FotorankContestRulesVersion_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRulesVersion"
ADD CONSTRAINT "FotorankContestRulesVersion_publishedByUserId_fkey"
FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FotorankContestRulesAuditEvent" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "rulesVersionId" TEXT NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestRulesAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankContestRulesAuditEvent_contestId_createdAt_idx"
ON "FotorankContestRulesAuditEvent"("contestId", "createdAt");

CREATE INDEX "FotorankContestRulesAuditEvent_rulesVersionId_createdAt_idx"
ON "FotorankContestRulesAuditEvent"("rulesVersionId", "createdAt");

CREATE INDEX "FotorankContestRulesAuditEvent_actorUserId_idx"
ON "FotorankContestRulesAuditEvent"("actorUserId");

ALTER TABLE "FotorankContestRulesAuditEvent"
ADD CONSTRAINT "FotorankContestRulesAuditEvent_rulesVersionId_fkey"
FOREIGN KEY ("rulesVersionId") REFERENCES "FotorankContestRulesVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRulesAuditEvent"
ADD CONSTRAINT "FotorankContestRulesAuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FotorankContestRegistration"
ADD COLUMN "rulesContentHashSnapshot" TEXT,
ADD COLUMN "configurationHashSnapshot" TEXT,
ADD COLUMN "licenseAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "licenseAcceptedAt" TIMESTAMP(3),
ADD COLUMN "promotionalOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "declaredAgeYears" INTEGER;

CREATE TABLE "FotorankMinorAuthorization" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantUserId" INTEGER NOT NULL,
    "guardianName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "declarationTextVersion" TEXT NOT NULL,
    "declarationAccepted" BOOLEAN NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptanceIp" TEXT,
    "acceptanceUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankMinorAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankMinorAuthorization_registrationId_key"
ON "FotorankMinorAuthorization"("registrationId");

CREATE INDEX "FotorankMinorAuthorization_contestId_idx"
ON "FotorankMinorAuthorization"("contestId");

CREATE INDEX "FotorankMinorAuthorization_participantUserId_idx"
ON "FotorankMinorAuthorization"("participantUserId");

ALTER TABLE "FotorankMinorAuthorization"
ADD CONSTRAINT "FotorankMinorAuthorization_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "FotorankContestRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankMinorAuthorization"
ADD CONSTRAINT "FotorankMinorAuthorization_participantUserId_fkey"
FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
