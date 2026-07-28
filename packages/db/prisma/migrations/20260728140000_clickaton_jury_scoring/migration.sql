-- Etapa 14 — Rúbricas, evaluaciones anónimas y sesión de scoring (LIVE off por defecto).

CREATE TYPE "FotorankJuryRubricStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE "FotorankJuryScoringMode" AS ENUM ('WEIGHTED_SCORE', 'SIMPLE_SUM', 'AVERAGE', 'STARS', 'ORDINAL', 'APPROVAL');
CREATE TYPE "FotorankJuryScoringSessionStatus" AS ENUM ('DRAFT', 'READY', 'OPEN', 'PAUSED', 'REVIEW_REQUIRED', 'CLOSED', 'LOCKED', 'CANCELLED');
CREATE TYPE "FotorankJuryEvaluationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'VOIDED');

ALTER TABLE "FotorankJudgeAssignment"
  ADD COLUMN IF NOT EXISTS "admissionBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "promptExternalId" TEXT;
CREATE INDEX IF NOT EXISTS "FotorankJudgeAssignment_admissionBatchId_idx" ON "FotorankJudgeAssignment"("admissionBatchId");

CREATE TABLE IF NOT EXISTS "FotorankJuryRubric" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "FotorankJuryRubricStatus" NOT NULL DEFAULT 'DRAFT',
  "scoringMode" "FotorankJuryScoringMode" NOT NULL DEFAULT 'WEIGHTED_SCORE',
  "minTotal" DOUBLE PRECISION,
  "maxTotal" DOUBLE PRECISION,
  "createdByUserId" INTEGER,
  "activatedByUserId" INTEGER,
  "activatedAt" TIMESTAMP(3),
  "criteriaSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryRubric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryRubric_contestId_name_version_key" ON "FotorankJuryRubric"("contestId", "name", "version");
CREATE INDEX IF NOT EXISTS "FotorankJuryRubric_contestId_status_idx" ON "FotorankJuryRubric"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryRubric_admissionBatchId_idx" ON "FotorankJuryRubric"("admissionBatchId");
ALTER TABLE "FotorankJuryRubric" DROP CONSTRAINT IF EXISTS "FotorankJuryRubric_contestId_fkey";
ALTER TABLE "FotorankJuryRubric" ADD CONSTRAINT "FotorankJuryRubric_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryRubric" DROP CONSTRAINT IF EXISTS "FotorankJuryRubric_admissionBatchId_fkey";
ALTER TABLE "FotorankJuryRubric" ADD CONSTRAINT "FotorankJuryRubric_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryCriterion" (
  "id" TEXT NOT NULL,
  "rubricId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "minScore" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "step" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "helpText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryCriterion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryCriterion_rubricId_key_key" ON "FotorankJuryCriterion"("rubricId", "key");
CREATE INDEX IF NOT EXISTS "FotorankJuryCriterion_rubricId_sortOrder_idx" ON "FotorankJuryCriterion"("rubricId", "sortOrder");
ALTER TABLE "FotorankJuryCriterion" DROP CONSTRAINT IF EXISTS "FotorankJuryCriterion_rubricId_fkey";
ALTER TABLE "FotorankJuryCriterion" ADD CONSTRAINT "FotorankJuryCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "FotorankJuryRubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryScoringSession" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT NOT NULL,
  "rubricId" TEXT NOT NULL,
  "status" "FotorankJuryScoringSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "scoringEnabled" BOOLEAN NOT NULL DEFAULT false,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "timelineVersionSnapshot" INTEGER,
  "minimumEvaluationsPerEntry" INTEGER NOT NULL DEFAULT 1,
  "assignmentsCount" INTEGER NOT NULL DEFAULT 0,
  "submittedEvaluationsCount" INTEGER NOT NULL DEFAULT 0,
  "incompleteEntriesCount" INTEGER NOT NULL DEFAULT 0,
  "assignmentSeed" TEXT,
  "openedByUserId" INTEGER,
  "closedByUserId" INTEGER,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryScoringSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotorankJuryScoringSession_contestId_status_idx" ON "FotorankJuryScoringSession"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryScoringSession_admissionBatchId_status_idx" ON "FotorankJuryScoringSession"("admissionBatchId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryScoringSession_rubricId_idx" ON "FotorankJuryScoringSession"("rubricId");
ALTER TABLE "FotorankJuryScoringSession" DROP CONSTRAINT IF EXISTS "FotorankJuryScoringSession_contestId_fkey";
ALTER TABLE "FotorankJuryScoringSession" ADD CONSTRAINT "FotorankJuryScoringSession_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryScoringSession" DROP CONSTRAINT IF EXISTS "FotorankJuryScoringSession_admissionBatchId_fkey";
ALTER TABLE "FotorankJuryScoringSession" ADD CONSTRAINT "FotorankJuryScoringSession_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryScoringSession" DROP CONSTRAINT IF EXISTS "FotorankJuryScoringSession_rubricId_fkey";
ALTER TABLE "FotorankJuryScoringSession" ADD CONSTRAINT "FotorankJuryScoringSession_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "FotorankJuryRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryEvaluation" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT NOT NULL,
  "scoringSessionId" TEXT,
  "juryEntrySnapshotId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "jurorId" TEXT NOT NULL,
  "rubricId" TEXT NOT NULL,
  "rubricVersion" INTEGER NOT NULL,
  "status" "FotorankJuryEvaluationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "totalScore" DOUBLE PRECISION,
  "normalizedScore" DOUBLE PRECISION,
  "privateComment" TEXT,
  "participantFeedback" TEXT,
  "startedAt" TIMESTAMP(3),
  "lastSavedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidedByUserId" INTEGER,
  "voidReason" TEXT,
  "idempotencyKey" TEXT,
  "expectedVersion" INTEGER NOT NULL DEFAULT 0,
  "engineVersion" TEXT NOT NULL DEFAULT 'clickaton-jury-scoring-v1',
  "criteriaSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryEvaluation_assignmentId_juryEntrySnapshotId_key" ON "FotorankJuryEvaluation"("assignmentId", "juryEntrySnapshotId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryEvaluation_idempotencyKey_key" ON "FotorankJuryEvaluation"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FotorankJuryEvaluation_contestId_status_idx" ON "FotorankJuryEvaluation"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryEvaluation_scoringSessionId_status_idx" ON "FotorankJuryEvaluation"("scoringSessionId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryEvaluation_jurorId_status_idx" ON "FotorankJuryEvaluation"("jurorId", "status");
CREATE INDEX IF NOT EXISTS "FotorankJuryEvaluation_juryEntrySnapshotId_idx" ON "FotorankJuryEvaluation"("juryEntrySnapshotId");
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_contestId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_admissionBatchId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_scoringSessionId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_juryEntrySnapshotId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_juryEntrySnapshotId_fkey" FOREIGN KEY ("juryEntrySnapshotId") REFERENCES "FotorankJuryEntrySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_assignmentId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FotorankJudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_jurorId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryEvaluation" DROP CONSTRAINT IF EXISTS "FotorankJuryEvaluation_rubricId_fkey";
ALTER TABLE "FotorankJuryEvaluation" ADD CONSTRAINT "FotorankJuryEvaluation_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "FotorankJuryRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryCriterionScore" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "criterionKeySnapshot" TEXT NOT NULL,
  "criterionNameSnapshot" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "weightSnapshot" DOUBLE PRECISION NOT NULL,
  "weightedScore" DOUBLE PRECISION NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJuryCriterionScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryCriterionScore_evaluationId_criterionId_key" ON "FotorankJuryCriterionScore"("evaluationId", "criterionId");
CREATE INDEX IF NOT EXISTS "FotorankJuryCriterionScore_evaluationId_idx" ON "FotorankJuryCriterionScore"("evaluationId");
ALTER TABLE "FotorankJuryCriterionScore" DROP CONSTRAINT IF EXISTS "FotorankJuryCriterionScore_evaluationId_fkey";
ALTER TABLE "FotorankJuryCriterionScore" ADD CONSTRAINT "FotorankJuryCriterionScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "FotorankJuryEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryCriterionScore" DROP CONSTRAINT IF EXISTS "FotorankJuryCriterionScore_criterionId_fkey";
ALTER TABLE "FotorankJuryCriterionScore" ADD CONSTRAINT "FotorankJuryCriterionScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "FotorankJuryCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "FotorankJuryPreliminaryAggregate" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "admissionBatchId" TEXT NOT NULL,
  "scoringSessionId" TEXT NOT NULL,
  "juryEntrySnapshotId" TEXT NOT NULL,
  "anonymousCode" TEXT NOT NULL,
  "evaluationCount" INTEGER NOT NULL DEFAULT 0,
  "averageScore" DOUBLE PRECISION,
  "medianScore" DOUBLE PRECISION,
  "normalizedAverage" DOUBLE PRECISION,
  "minScore" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "stdDev" DOUBLE PRECISION,
  "coverageComplete" BOOLEAN NOT NULL DEFAULT false,
  "engineVersion" TEXT NOT NULL DEFAULT 'clickaton-jury-scoring-v1',
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "FotorankJuryPreliminaryAggregate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJuryPreliminaryAggregate_scoringSessionId_juryEntrySnapshotId_key" ON "FotorankJuryPreliminaryAggregate"("scoringSessionId", "juryEntrySnapshotId");
CREATE INDEX IF NOT EXISTS "FotorankJuryPreliminaryAggregate_contestId_scoringSessionId_idx" ON "FotorankJuryPreliminaryAggregate"("contestId", "scoringSessionId");
CREATE INDEX IF NOT EXISTS "FotorankJuryPreliminaryAggregate_anonymousCode_idx" ON "FotorankJuryPreliminaryAggregate"("anonymousCode");
ALTER TABLE "FotorankJuryPreliminaryAggregate" DROP CONSTRAINT IF EXISTS "FotorankJuryPreliminaryAggregate_contestId_fkey";
ALTER TABLE "FotorankJuryPreliminaryAggregate" ADD CONSTRAINT "FotorankJuryPreliminaryAggregate_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryPreliminaryAggregate" DROP CONSTRAINT IF EXISTS "FotorankJuryPreliminaryAggregate_admissionBatchId_fkey";
ALTER TABLE "FotorankJuryPreliminaryAggregate" ADD CONSTRAINT "FotorankJuryPreliminaryAggregate_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryPreliminaryAggregate" DROP CONSTRAINT IF EXISTS "FotorankJuryPreliminaryAggregate_scoringSessionId_fkey";
ALTER TABLE "FotorankJuryPreliminaryAggregate" ADD CONSTRAINT "FotorankJuryPreliminaryAggregate_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryPreliminaryAggregate" DROP CONSTRAINT IF EXISTS "FotorankJuryPreliminaryAggregate_juryEntrySnapshotId_fkey";
ALTER TABLE "FotorankJuryPreliminaryAggregate" ADD CONSTRAINT "FotorankJuryPreliminaryAggregate_juryEntrySnapshotId_fkey" FOREIGN KEY ("juryEntrySnapshotId") REFERENCES "FotorankJuryEntrySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
