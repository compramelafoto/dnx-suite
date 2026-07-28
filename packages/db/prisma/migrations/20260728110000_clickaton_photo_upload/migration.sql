-- Etapa 11: carga de fotografías, EXIF/GPS, vínculo Entry ↔ consigna Clickatón

-- AlterEnum
ALTER TYPE "FotorankContestEntryStatus" ADD VALUE IF NOT EXISTS 'REPLACED';

-- AlterTable FotorankContestEntry
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "sourcePlatform" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "externalEditionId" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "externalRegistrationId" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "externalPromptId" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "externalParticipantId" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "clickatonParticipantNumber" TEXT;
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "captureWindowStartsAtSnapshot" TIMESTAMP(3);
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "captureWindowEndsAtSnapshot" TIMESTAMP(3);
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "uploadWindowStartsAtSnapshot" TIMESTAMP(3);
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "uploadWindowEndsAtSnapshot" TIMESTAMP(3);
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "participantDeclarationAcceptedAt" TIMESTAMP(3);
ALTER TABLE "FotorankContestEntry" ADD COLUMN IF NOT EXISTS "participantDeclarationVersion" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestEntry_contestId_externalRegistrationId_externalPromptId_key"
  ON "FotorankContestEntry"("contestId", "externalRegistrationId", "externalPromptId");

CREATE INDEX IF NOT EXISTS "FotorankContestEntry_sourcePlatform_externalEditionId_idx"
  ON "FotorankContestEntry"("sourcePlatform", "externalEditionId");
CREATE INDEX IF NOT EXISTS "FotorankContestEntry_externalPromptId_idx"
  ON "FotorankContestEntry"("externalPromptId");
CREATE INDEX IF NOT EXISTS "FotorankContestEntry_externalRegistrationId_idx"
  ON "FotorankContestEntry"("externalRegistrationId");

-- ClickatonPrompt extensions
CREATE TYPE "ClickatonPromptGpsMode" AS ENUM ('OPTIONAL', 'REQUIRED', 'NOT_REQUIRED', 'GEOFENCE');

ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "uploadStartsAt" TIMESTAMP(3);
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "minEntries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "maxEntries" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "allowReplacement" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "replacementDeadline" TIMESTAMP(3);
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "captureClockToleranceMinutes" INTEGER;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "gpsMode" "ClickatonPromptGpsMode" NOT NULL DEFAULT 'OPTIONAL';
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "deviceCategoryHint" TEXT;

CREATE TYPE "ClickatonPhotoSubmissionStatus" AS ENUM (
  'UPLOAD_PENDING', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY_FOR_REVIEW',
  'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'FAILED', 'REPLACED', 'WITHDRAWN'
);
CREATE TYPE "ClickatonPhotoValidationResult" AS ENUM ('PASS', 'WARNING', 'FAIL', 'MANUAL_REVIEW');
CREATE TYPE "ClickatonPhotoJobStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'RETRY_PENDING', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW'
);

CREATE TABLE IF NOT EXISTS "ClickatonEditionUploadConfig" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "uploadsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "allowedMimeTypes" JSONB NOT NULL DEFAULT '["image/jpeg","image/png","image/webp"]',
  "maxFileSizeBytes" INTEGER NOT NULL DEFAULT 26214400,
  "minWidth" INTEGER NOT NULL DEFAULT 800,
  "minHeight" INTEGER NOT NULL DEFAULT 600,
  "maxWidth" INTEGER NOT NULL DEFAULT 12000,
  "maxHeight" INTEGER NOT NULL DEFAULT 12000,
  "captureClockToleranceMinutes" INTEGER NOT NULL DEFAULT 5,
  "defaultGpsMode" "ClickatonPromptGpsMode" NOT NULL DEFAULT 'OPTIONAL',
  "allowCrossPromptDuplicate" BOOLEAN NOT NULL DEFAULT false,
  "blockCrossParticipantDuplicate" BOOLEAN NOT NULL DEFAULT false,
  "reviewCrossParticipantDuplicate" BOOLEAN NOT NULL DEFAULT true,
  "rulesDeclarationVersion" TEXT NOT NULL DEFAULT 'clickaton-rules-draft-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonEditionUploadConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonEditionUploadConfig_editionId_key"
  ON "ClickatonEditionUploadConfig"("editionId");

ALTER TABLE "ClickatonEditionUploadConfig"
  ADD CONSTRAINT "ClickatonEditionUploadConfig_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonPhotoSubmission" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "fotorankContestId" TEXT,
  "fotorankParticipantId" TEXT,
  "fotorankEntryId" TEXT,
  "status" "ClickatonPhotoSubmissionStatus" NOT NULL DEFAULT 'UPLOAD_PENDING',
  "validationResult" "ClickatonPhotoValidationResult",
  "sha256" TEXT,
  "originalStorageKey" TEXT,
  "previewStorageKey" TEXT,
  "captureWindowStartsAt" TIMESTAMP(3),
  "captureWindowEndsAt" TIMESTAMP(3),
  "uploadWindowStartsAt" TIMESTAMP(3),
  "uploadWindowEndsAt" TIMESTAMP(3),
  "captureDateInterpreted" TIMESTAMP(3),
  "captureTimezoneAssumed" TEXT,
  "captureDeltaMinutes" INTEGER,
  "gpsStatus" TEXT,
  "gpsLatitude" DOUBLE PRECISION,
  "gpsLongitude" DOUBLE PRECISION,
  "exifStatus" TEXT,
  "technicalSummaryJson" JSONB,
  "participantDeclarationAcceptedAt" TIMESTAMP(3),
  "participantDeclarationVersion" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "replacedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonPhotoSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_registrationId_promptId_key"
  ON "ClickatonPhotoSubmission"("registrationId", "promptId");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_editionId_status_idx"
  ON "ClickatonPhotoSubmission"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_promptId_status_idx"
  ON "ClickatonPhotoSubmission"("promptId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_fotorankEntryId_idx"
  ON "ClickatonPhotoSubmission"("fotorankEntryId");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_sha256_idx"
  ON "ClickatonPhotoSubmission"("sha256");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmission_userId_idx"
  ON "ClickatonPhotoSubmission"("userId");

ALTER TABLE "ClickatonPhotoSubmission"
  ADD CONSTRAINT "ClickatonPhotoSubmission_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonPhotoSubmission"
  ADD CONSTRAINT "ClickatonPhotoSubmission_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClickatonPhotoSubmission"
  ADD CONSTRAINT "ClickatonPhotoSubmission_promptId_fkey"
  FOREIGN KEY ("promptId") REFERENCES "ClickatonPrompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonPhotoSubmissionJob" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "ClickatonPhotoJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ClickatonPhotoSubmissionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmissionJob_status_nextRetryAt_idx"
  ON "ClickatonPhotoSubmissionJob"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmissionJob_submissionId_kind_idx"
  ON "ClickatonPhotoSubmissionJob"("submissionId", "kind");

ALTER TABLE "ClickatonPhotoSubmissionJob"
  ADD CONSTRAINT "ClickatonPhotoSubmissionJob_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "ClickatonPhotoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClickatonPhotoSubmissionAudit" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "actorUserId" INTEGER,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonPhotoSubmissionAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmissionAudit_submissionId_createdAt_idx"
  ON "ClickatonPhotoSubmissionAudit"("submissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonPhotoSubmissionAudit_action_idx"
  ON "ClickatonPhotoSubmissionAudit"("action");

ALTER TABLE "ClickatonPhotoSubmissionAudit"
  ADD CONSTRAINT "ClickatonPhotoSubmissionAudit_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "ClickatonPhotoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
