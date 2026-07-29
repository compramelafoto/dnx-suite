-- Etapa 15 — Ranking privado, desempates y resultados (sin publicación LIVE).

CREATE TYPE "FotorankResultRuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE "FotorankResultAggregationMethod" AS ENUM ('WEIGHTED_AVERAGE', 'AVERAGE', 'MEDIAN', 'SUM', 'TRIMMED_MEAN', 'ORDINAL');
CREATE TYPE "FotorankResultTieBreakStrategy" AS ENUM ('PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION', 'MEDIAN_THEN_DISPERSION', 'MANUAL_ONLY', 'SHARED_TIE');
CREATE TYPE "FotorankResultCoverageStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'INVALID', 'REVIEW_REQUIRED');
CREATE TYPE "FotorankResultBatchStatus" AS ENUM ('DRAFT', 'GENERATED', 'REVIEW_REQUIRED', 'READY_TO_FINALIZE', 'FINALIZED', 'PUBLISHED', 'CANCELLED');
CREATE TYPE "FotorankResultEntryStatus" AS ENUM ('RANKED', 'TIED', 'REVIEW_REQUIRED', 'DISQUALIFIED', 'WINNER', 'FINALIST', 'MENTION', 'NOT_SELECTED');
CREATE TYPE "FotorankAwardType" AS ENUM ('FIRST_PLACE', 'SECOND_PLACE', 'THIRD_PLACE', 'FINALIST', 'HONORABLE_MENTION', 'SPECIAL_MENTION', 'PEOPLE_CHOICE', 'SPONSOR_AWARD', 'CUSTOM');
CREATE TYPE "FotorankTieBreakSessionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "FotorankResultScope" AS ENUM ('GENERAL', 'CATEGORY', 'PROMPT', 'CATEGORY_AND_PROMPT', 'SPECIAL');

CREATE TABLE IF NOT EXISTS "FotorankResultRuleSet" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT,
  "scoringSessionId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL DEFAULT 'Reglas de resultados',
  "status" "FotorankResultRuleSetStatus" NOT NULL DEFAULT 'DRAFT',
  "aggregationMethod" "FotorankResultAggregationMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
  "tieBreakStrategy" "FotorankResultTieBreakStrategy" NOT NULL DEFAULT 'PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION',
  "minimumValidEvaluations" INTEGER NOT NULL DEFAULT 1,
  "discardHighestScore" BOOLEAN NOT NULL DEFAULT false,
  "discardLowestScore" BOOLEAN NOT NULL DEFAULT false,
  "normalizationMode" TEXT NOT NULL DEFAULT 'NORMALIZED_TOTAL',
  "priorityCriterionKey" TEXT,
  "rankingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "winnersPerScope" INTEGER NOT NULL DEFAULT 1,
  "allowMultipleAwards" BOOLEAN NOT NULL DEFAULT true,
  "oneAwardPerParticipant" BOOLEAN NOT NULL DEFAULT false,
  "incompleteCoveragePolicy" TEXT NOT NULL DEFAULT 'BLOCK_FINALIZE',
  "createdByUserId" INTEGER,
  "activatedByUserId" INTEGER,
  "activatedAt" TIMESTAMP(3),
  "configJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankResultRuleSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankResultRuleSet_contestId_name_version_key" ON "FotorankResultRuleSet"("contestId", "name", "version");
CREATE INDEX IF NOT EXISTS "FotorankResultRuleSet_contestId_status_idx" ON "FotorankResultRuleSet"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankResultRuleSet_scoringSessionId_idx" ON "FotorankResultRuleSet"("scoringSessionId");
ALTER TABLE "FotorankResultRuleSet" DROP CONSTRAINT IF EXISTS "FotorankResultRuleSet_contestId_fkey";
ALTER TABLE "FotorankResultRuleSet" ADD CONSTRAINT "FotorankResultRuleSet_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankResultRuleSet" DROP CONSTRAINT IF EXISTS "FotorankResultRuleSet_admissionBatchId_fkey";
ALTER TABLE "FotorankResultRuleSet" ADD CONSTRAINT "FotorankResultRuleSet_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankResultRuleSet" DROP CONSTRAINT IF EXISTS "FotorankResultRuleSet_scoringSessionId_fkey";
ALTER TABLE "FotorankResultRuleSet" ADD CONSTRAINT "FotorankResultRuleSet_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankResultBatch" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT NOT NULL,
  "scoringSessionId" TEXT NOT NULL,
  "ruleSetId" TEXT NOT NULL,
  "status" "FotorankResultBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "scope" "FotorankResultScope" NOT NULL DEFAULT 'CATEGORY_AND_PROMPT',
  "generatedAt" TIMESTAMP(3),
  "generatedByUserId" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" INTEGER,
  "finalizedAt" TIMESTAMP(3),
  "finalizedByUserId" INTEGER,
  "publishedAt" TIMESTAMP(3),
  "publishedByUserId" INTEGER,
  "publicationApproved" BOOLEAN NOT NULL DEFAULT false,
  "engineVersion" TEXT NOT NULL DEFAULT 'clickaton-ranking-v1',
  "ruleSetVersion" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankResultBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankResultBatch_idempotencyKey_key" ON "FotorankResultBatch"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FotorankResultBatch_contestId_status_idx" ON "FotorankResultBatch"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankResultBatch_scoringSessionId_status_idx" ON "FotorankResultBatch"("scoringSessionId", "status");
CREATE INDEX IF NOT EXISTS "FotorankResultBatch_ruleSetId_idx" ON "FotorankResultBatch"("ruleSetId");
ALTER TABLE "FotorankResultBatch" DROP CONSTRAINT IF EXISTS "FotorankResultBatch_contestId_fkey";
ALTER TABLE "FotorankResultBatch" ADD CONSTRAINT "FotorankResultBatch_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankResultBatch" DROP CONSTRAINT IF EXISTS "FotorankResultBatch_admissionBatchId_fkey";
ALTER TABLE "FotorankResultBatch" ADD CONSTRAINT "FotorankResultBatch_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankResultBatch" DROP CONSTRAINT IF EXISTS "FotorankResultBatch_scoringSessionId_fkey";
ALTER TABLE "FotorankResultBatch" ADD CONSTRAINT "FotorankResultBatch_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankResultBatch" DROP CONSTRAINT IF EXISTS "FotorankResultBatch_ruleSetId_fkey";
ALTER TABLE "FotorankResultBatch" ADD CONSTRAINT "FotorankResultBatch_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "FotorankResultRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankResultEntry" (
  "id" TEXT NOT NULL,
  "resultBatchId" TEXT NOT NULL,
  "juryEntrySnapshotId" TEXT NOT NULL,
  "anonymousCode" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "promptExternalId" TEXT,
  "scopeKey" TEXT NOT NULL,
  "aggregateScore" DOUBLE PRECISION,
  "normalizedScore" DOUBLE PRECISION,
  "medianScore" DOUBLE PRECISION,
  "dispersion" DOUBLE PRECISION,
  "evaluationCount" INTEGER NOT NULL DEFAULT 0,
  "coverageStatus" "FotorankResultCoverageStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "preliminaryPosition" INTEGER,
  "finalPosition" INTEGER,
  "tieGroup" TEXT,
  "resultStatus" "FotorankResultEntryStatus" NOT NULL DEFAULT 'RANKED',
  "awardType" "FotorankAwardType",
  "juryDecisionNote" TEXT,
  "flagsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankResultEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankResultEntry_resultBatchId_juryEntrySnapshotId_scopeKey_key" ON "FotorankResultEntry"("resultBatchId", "juryEntrySnapshotId", "scopeKey");
CREATE INDEX IF NOT EXISTS "FotorankResultEntry_resultBatchId_preliminaryPosition_idx" ON "FotorankResultEntry"("resultBatchId", "preliminaryPosition");
CREATE INDEX IF NOT EXISTS "FotorankResultEntry_anonymousCode_idx" ON "FotorankResultEntry"("anonymousCode");
CREATE INDEX IF NOT EXISTS "FotorankResultEntry_categoryId_promptExternalId_idx" ON "FotorankResultEntry"("categoryId", "promptExternalId");
ALTER TABLE "FotorankResultEntry" DROP CONSTRAINT IF EXISTS "FotorankResultEntry_resultBatchId_fkey";
ALTER TABLE "FotorankResultEntry" ADD CONSTRAINT "FotorankResultEntry_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "FotorankResultBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankResultEntry" DROP CONSTRAINT IF EXISTS "FotorankResultEntry_juryEntrySnapshotId_fkey";
ALTER TABLE "FotorankResultEntry" ADD CONSTRAINT "FotorankResultEntry_juryEntrySnapshotId_fkey" FOREIGN KEY ("juryEntrySnapshotId") REFERENCES "FotorankJuryEntrySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankTieBreakSession" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "resultBatchId" TEXT NOT NULL,
  "tieGroup" TEXT NOT NULL,
  "status" "FotorankTieBreakSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "strategy" TEXT NOT NULL DEFAULT 'ORDINAL_VOTE',
  "jurorIdsJson" JSONB,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdByUserId" INTEGER,
  "closedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankTieBreakSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotorankTieBreakSession_contestId_status_idx" ON "FotorankTieBreakSession"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankTieBreakSession_resultBatchId_tieGroup_idx" ON "FotorankTieBreakSession"("resultBatchId", "tieGroup");
ALTER TABLE "FotorankTieBreakSession" DROP CONSTRAINT IF EXISTS "FotorankTieBreakSession_contestId_fkey";
ALTER TABLE "FotorankTieBreakSession" ADD CONSTRAINT "FotorankTieBreakSession_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankTieBreakSession" DROP CONSTRAINT IF EXISTS "FotorankTieBreakSession_resultBatchId_fkey";
ALTER TABLE "FotorankTieBreakSession" ADD CONSTRAINT "FotorankTieBreakSession_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "FotorankResultBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankResultExclusion" (
  "id" TEXT NOT NULL,
  "resultEntryId" TEXT NOT NULL,
  "reasonInternal" TEXT NOT NULL,
  "reasonPublic" TEXT,
  "actorUserId" INTEGER NOT NULL,
  "evidenceJson" JSONB,
  "impactNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankResultExclusion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotorankResultExclusion_resultEntryId_idx" ON "FotorankResultExclusion"("resultEntryId");
ALTER TABLE "FotorankResultExclusion" DROP CONSTRAINT IF EXISTS "FotorankResultExclusion_resultEntryId_fkey";
ALTER TABLE "FotorankResultExclusion" ADD CONSTRAINT "FotorankResultExclusion_resultEntryId_fkey" FOREIGN KEY ("resultEntryId") REFERENCES "FotorankResultEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankResultRevision" (
  "id" TEXT NOT NULL,
  "resultBatchId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankResultRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankResultRevision_resultBatchId_revisionNumber_key" ON "FotorankResultRevision"("resultBatchId", "revisionNumber");
CREATE INDEX IF NOT EXISTS "FotorankResultRevision_resultBatchId_idx" ON "FotorankResultRevision"("resultBatchId");
ALTER TABLE "FotorankResultRevision" DROP CONSTRAINT IF EXISTS "FotorankResultRevision_resultBatchId_fkey";
ALTER TABLE "FotorankResultRevision" ADD CONSTRAINT "FotorankResultRevision_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "FotorankResultBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
