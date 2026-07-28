-- FotoRank P0-07: conflictos de interés del jurado + enums de evaluación mínima.
-- Aplicar solo en DB local limpia (nunca Neon con drift).

CREATE TYPE "FotorankJudgeConflictReasonCode" AS ENUM (
  'KNOW_AUTHOR',
  'PROFESSIONAL_RELATION',
  'FAMILY_RELATION',
  'PARTICIPATED_IN_PRODUCTION',
  'OTHER'
);

CREATE TYPE "FotorankJudgeConflictStatus" AS ENUM (
  'ACTIVE',
  'REVIEWED',
  'DISMISSED'
);

CREATE TYPE "FotorankJudgeEntryEvalStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CONFLICT_DECLARED'
);

CREATE TABLE "FotorankJudgeEntryConflict" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "reasonCode" "FotorankJudgeConflictReasonCode" NOT NULL,
    "notes" TEXT,
    "status" "FotorankJudgeConflictStatus" NOT NULL DEFAULT 'ACTIVE',
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeEntryConflict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankJudgeEntryConflict_entryId_judgeAccountId_key"
  ON "FotorankJudgeEntryConflict"("entryId", "judgeAccountId");

CREATE INDEX "FotorankJudgeEntryConflict_contestId_judgeAccountId_idx"
  ON "FotorankJudgeEntryConflict"("contestId", "judgeAccountId");

CREATE INDEX "FotorankJudgeEntryConflict_contestId_status_idx"
  ON "FotorankJudgeEntryConflict"("contestId", "status");

CREATE INDEX "FotorankJudgeEntryConflict_judgeAccountId_status_idx"
  ON "FotorankJudgeEntryConflict"("judgeAccountId", "status");

ALTER TABLE "FotorankJudgeEntryConflict"
  ADD CONSTRAINT "FotorankJudgeEntryConflict_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankJudgeEntryConflict"
  ADD CONSTRAINT "FotorankJudgeEntryConflict_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankJudgeEntryConflict"
  ADD CONSTRAINT "FotorankJudgeEntryConflict_judgeAccountId_fkey"
  FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FotorankJudgeEntryConflict"
  ADD CONSTRAINT "FotorankJudgeEntryConflict_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
