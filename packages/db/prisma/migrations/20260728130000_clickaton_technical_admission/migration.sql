-- Etapa 13 — Admisión técnica de obras (Clickatón ↔ FotoRank). Sin jurado/scores LIVE.

CREATE TYPE "FotorankTechnicalAdmissionStatus" AS ENUM (
  'NOT_EVALUATED',
  'PENDING_AUTOMATIC_REVIEW',
  'PENDING_MANUAL_REVIEW',
  'ELIGIBLE',
  'ADMITTED',
  'REJECTED',
  'EXCLUDED',
  'WITHDRAWN',
  'REPLACED',
  'FROZEN_FOR_JURY'
);

CREATE TYPE "FotorankAdmissionBatchStatus" AS ENUM (
  'DRAFT',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'READY_TO_CLOSE',
  'CLOSED',
  'FROZEN',
  'CANCELLED'
);

CREATE TYPE "ClickatonAccreditationAdmissionPolicy" AS ENUM (
  'NOT_REQUIRED',
  'REQUIRED',
  'OPTIONAL_WITH_REVIEW'
);

ALTER TABLE "FotorankContestEntry"
  ADD COLUMN IF NOT EXISTS "admissionStatus" "FotorankTechnicalAdmissionStatus",
  ADD COLUMN IF NOT EXISTS "admissionBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "anonymousJuryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "appealAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "appealDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "appealStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "publicRejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "internalRejectionReason" TEXT;

CREATE TABLE IF NOT EXISTS "FotorankAdmissionBatch" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "editionId" TEXT,
  "timelineVersion" INTEGER,
  "rulesVersion" TEXT,
  "engineVersion" TEXT NOT NULL DEFAULT 'clickaton-admission-v1',
  "status" "FotorankAdmissionBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "totalEntries" INTEGER NOT NULL DEFAULT 0,
  "eligibleEntries" INTEGER NOT NULL DEFAULT 0,
  "admittedEntries" INTEGER NOT NULL DEFAULT 0,
  "rejectedEntries" INTEGER NOT NULL DEFAULT 0,
  "pendingReviewEntries" INTEGER NOT NULL DEFAULT 0,
  "frozenEntries" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" INTEGER,
  "closedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "frozenAt" TIMESTAMP(3),
  "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankAdmissionBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FotorankAdmissionBatch_contestId_status_idx" ON "FotorankAdmissionBatch"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankAdmissionBatch_editionId_idx" ON "FotorankAdmissionBatch"("editionId");

ALTER TABLE "FotorankAdmissionBatch"
  DROP CONSTRAINT IF EXISTS "FotorankAdmissionBatch_contestId_fkey";
ALTER TABLE "FotorankAdmissionBatch"
  ADD CONSTRAINT "FotorankAdmissionBatch_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryEntrySnapshot" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "admissionBatchId" TEXT NOT NULL,
  "originalAssetId" TEXT,
  "juryAssetId" TEXT,
  "sha256" TEXT,
  "sha256Jury" TEXT,
  "categoryId" TEXT NOT NULL,
  "promptExternalId" TEXT,
  "participantId" TEXT,
  "anonymousCode" TEXT NOT NULL,
  "admittedAt" TIMESTAMP(3),
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataSnapshot" JSONB,
  "validationSnapshot" JSONB,
  "rendererVersion" TEXT,
  "processingVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryEntrySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryEntrySnapshot_admissionBatchId_entryId_key"
  ON "FotorankJuryEntrySnapshot"("admissionBatchId", "entryId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryEntrySnapshot_admissionBatchId_anonymousCode_key"
  ON "FotorankJuryEntrySnapshot"("admissionBatchId", "anonymousCode");
CREATE INDEX IF NOT EXISTS "FotorankJuryEntrySnapshot_contestId_admissionBatchId_idx"
  ON "FotorankJuryEntrySnapshot"("contestId", "admissionBatchId");
CREATE INDEX IF NOT EXISTS "FotorankJuryEntrySnapshot_entryId_idx" ON "FotorankJuryEntrySnapshot"("entryId");

ALTER TABLE "FotorankJuryEntrySnapshot"
  DROP CONSTRAINT IF EXISTS "FotorankJuryEntrySnapshot_contestId_fkey";
ALTER TABLE "FotorankJuryEntrySnapshot"
  ADD CONSTRAINT "FotorankJuryEntrySnapshot_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEntrySnapshot"
  DROP CONSTRAINT IF EXISTS "FotorankJuryEntrySnapshot_entryId_fkey";
ALTER TABLE "FotorankJuryEntrySnapshot"
  ADD CONSTRAINT "FotorankJuryEntrySnapshot_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEntrySnapshot"
  DROP CONSTRAINT IF EXISTS "FotorankJuryEntrySnapshot_admissionBatchId_fkey";
ALTER TABLE "FotorankJuryEntrySnapshot"
  ADD CONSTRAINT "FotorankJuryEntrySnapshot_admissionBatchId_fkey"
  FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestEntry_contestId_anonymousJuryCode_key"
  ON "FotorankContestEntry"("contestId", "anonymousJuryCode");
CREATE INDEX IF NOT EXISTS "FotorankContestEntry_contestId_admissionStatus_idx"
  ON "FotorankContestEntry"("contestId", "admissionStatus");
CREATE INDEX IF NOT EXISTS "FotorankContestEntry_admissionBatchId_idx"
  ON "FotorankContestEntry"("admissionBatchId");

ALTER TABLE "FotorankContestEntry"
  DROP CONSTRAINT IF EXISTS "FotorankContestEntry_admissionBatchId_fkey";
ALTER TABLE "FotorankContestEntry"
  ADD CONSTRAINT "FotorankContestEntry_admissionBatchId_fkey"
  FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonEditionAdmissionConfig" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "admissionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "accreditationRequiredForAdmission" "ClickatonAccreditationAdmissionPolicy" NOT NULL DEFAULT 'NOT_REQUIRED',
  "rulesVersion" TEXT NOT NULL DEFAULT 'clickaton-admission-rules-draft-v1',
  "engineVersion" TEXT NOT NULL DEFAULT 'clickaton-admission-v1',
  "requireDeclaration" BOOLEAN NOT NULL DEFAULT true,
  "allowAppealOnReject" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonEditionAdmissionConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEditionAdmissionConfig_editionId_key"
  ON "ClickatonEditionAdmissionConfig"("editionId");
ALTER TABLE "ClickatonEditionAdmissionConfig"
  DROP CONSTRAINT IF EXISTS "ClickatonEditionAdmissionConfig_editionId_fkey";
ALTER TABLE "ClickatonEditionAdmissionConfig"
  ADD CONSTRAINT "ClickatonEditionAdmissionConfig_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonTechnicalAdmissionDecision" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fotorankEntryId" TEXT,
  "admissionBatchId" TEXT,
  "eligible" BOOLEAN NOT NULL DEFAULT false,
  "status" "FotorankTechnicalAdmissionStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
  "blockingReasons" JSONB NOT NULL DEFAULT '[]',
  "warningReasons" JSONB NOT NULL DEFAULT '[]',
  "manualReviewReasons" JSONB NOT NULL DEFAULT '[]',
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatorVersion" TEXT NOT NULL,
  "timelineVersion" INTEGER,
  "rulesVersion" TEXT NOT NULL,
  "sourceSubmissionId" TEXT NOT NULL,
  "sourceEntryId" TEXT,
  "actorUserId" INTEGER,
  "reason" TEXT,
  "publicRejectionReason" TEXT,
  "internalRejectionReason" TEXT,
  "previousDecisionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonTechnicalAdmissionDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonTechnicalAdmissionDecision_editionId_status_idx"
  ON "ClickatonTechnicalAdmissionDecision"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonTechnicalAdmissionDecision_submissionId_evaluatedAt_idx"
  ON "ClickatonTechnicalAdmissionDecision"("submissionId", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "ClickatonTechnicalAdmissionDecision_fotorankEntryId_idx"
  ON "ClickatonTechnicalAdmissionDecision"("fotorankEntryId");
CREATE INDEX IF NOT EXISTS "ClickatonTechnicalAdmissionDecision_admissionBatchId_idx"
  ON "ClickatonTechnicalAdmissionDecision"("admissionBatchId");

ALTER TABLE "ClickatonTechnicalAdmissionDecision"
  DROP CONSTRAINT IF EXISTS "ClickatonTechnicalAdmissionDecision_editionId_fkey";
ALTER TABLE "ClickatonTechnicalAdmissionDecision"
  ADD CONSTRAINT "ClickatonTechnicalAdmissionDecision_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonAdmissionAudit" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "submissionId" TEXT,
  "fotorankEntryId" TEXT,
  "admissionBatchId" TEXT,
  "action" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "previousValue" JSONB,
  "nextValue" JSONB,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonAdmissionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonAdmissionAudit_editionId_createdAt_idx"
  ON "ClickatonAdmissionAudit"("editionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonAdmissionAudit_submissionId_idx" ON "ClickatonAdmissionAudit"("submissionId");
CREATE INDEX IF NOT EXISTS "ClickatonAdmissionAudit_action_idx" ON "ClickatonAdmissionAudit"("action");
CREATE INDEX IF NOT EXISTS "ClickatonAdmissionAudit_admissionBatchId_idx" ON "ClickatonAdmissionAudit"("admissionBatchId");

ALTER TABLE "ClickatonAdmissionAudit"
  DROP CONSTRAINT IF EXISTS "ClickatonAdmissionAudit_editionId_fkey";
ALTER TABLE "ClickatonAdmissionAudit"
  ADD CONSTRAINT "ClickatonAdmissionAudit_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonAdmissionJob" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "ClickatonPhotoJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ClickatonAdmissionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonAdmissionJob_requestId_key" ON "ClickatonAdmissionJob"("requestId");
CREATE INDEX IF NOT EXISTS "ClickatonAdmissionJob_editionId_status_idx" ON "ClickatonAdmissionJob"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonAdmissionJob_status_nextRetryAt_idx" ON "ClickatonAdmissionJob"("status", "nextRetryAt");

ALTER TABLE "ClickatonAdmissionJob"
  DROP CONSTRAINT IF EXISTS "ClickatonAdmissionJob_editionId_fkey";
ALTER TABLE "ClickatonAdmissionJob"
  ADD CONSTRAINT "ClickatonAdmissionJob_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
