-- ETAPA 16A — Core domain: elegibilidad competitiva, capacidad de jurado, actividad/ETA.
-- 100% aditivo. Reutiliza FotorankJury* existente; NO crea tablas ClickatonJury*.
-- No activa scoringEnabled en ningún concurso comercial.

-- 1) Enum: agregar POSTPONED ("revisar después" — §7.2 master rules).
ALTER TYPE "FotorankJuryEvaluationStatus" ADD VALUE 'POSTPONED';

-- 2) FotorankJuryEvaluation — postergar / confirmar bloque / tiempo activo.
ALTER TABLE "FotorankJuryEvaluation" ADD COLUMN IF NOT EXISTS "postponedAt" TIMESTAMP(3);
ALTER TABLE "FotorankJuryEvaluation" ADD COLUMN IF NOT EXISTS "confirmedBlockAt" TIMESTAMP(3);
ALTER TABLE "FotorankJuryEvaluation" ADD COLUMN IF NOT EXISTS "activeSecondsAccumulated" INTEGER NOT NULL DEFAULT 0;

-- 3) FotorankJuryScoringSession — capacidad recomendada + escala de score.
ALTER TABLE "FotorankJuryScoringSession" ADD COLUMN IF NOT EXISTS "recommendedMaxEntriesPerJudge" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "FotorankJuryScoringSession" ADD COLUMN IF NOT EXISTS "scoreIntegerOnly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FotorankJuryScoringSession" ADD COLUMN IF NOT EXISTS "scoreScaleMin" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FotorankJuryScoringSession" ADD COLUMN IF NOT EXISTS "scoreScaleMax" INTEGER NOT NULL DEFAULT 10;

-- 4) FotorankCompetitionJuryConfig — configuración de jurado competitivo por concurso.
CREATE TABLE "FotorankCompetitionJuryConfig" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "minimumValidEntriesForCompetition" INTEGER,
    "requiredEvaluationsPerEntry" INTEGER NOT NULL DEFAULT 3,
    "recommendedMaxEntriesPerJudge" INTEGER NOT NULL DEFAULT 500,
    "evaluationStartsAt" TIMESTAMP(3),
    "evaluationEndsAt" TIMESTAMP(3),
    "scoreScaleMin" INTEGER NOT NULL DEFAULT 1,
    "scoreScaleMax" INTEGER NOT NULL DEFAULT 10,
    "scoreIntegerOnly" BOOLEAN NOT NULL DEFAULT true,
    "finalistsPerUnit" INTEGER NOT NULL DEFAULT 3,
    "publicVoteMode" TEXT NOT NULL DEFAULT 'DISABLED',
    "criteriaConfigJson" JSONB,
    "yellowLoadThreshold" INTEGER NOT NULL DEFAULT 501,
    "redLoadThreshold" INTEGER NOT NULL DEFAULT 651,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotorankCompetitionJuryConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankCompetitionJuryConfig_contestId_key" ON "FotorankCompetitionJuryConfig"("contestId");
CREATE INDEX "FotorankCompetitionJuryConfig_contestId_idx" ON "FotorankCompetitionJuryConfig"("contestId");

ALTER TABLE "FotorankCompetitionJuryConfig" ADD CONSTRAINT "FotorankCompetitionJuryConfig_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) FotorankCompetitiveEligibilityFreeze — congelamiento de elegibilidad competitiva.
CREATE TABLE "FotorankCompetitiveEligibilityFreeze" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "admissionBatchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ELIGIBILITY_DRAFT',
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "minimumValidEntries" INTEGER NOT NULL,
    "totalParticipants" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "notEligibleCount" INTEGER NOT NULL,
    "validEntriesCount" INTEGER NOT NULL,
    "excludedEntriesCount" INTEGER NOT NULL,
    "reasonCodesJson" JSONB,
    "configSnapshotJson" JSONB,
    "rosterHash" TEXT,
    "frozenAt" TIMESTAMP(3),
    "frozenByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotorankCompetitiveEligibilityFreeze_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankCompetitiveEligibilityFreeze_contestId_configVersio_key" ON "FotorankCompetitiveEligibilityFreeze"("contestId", "configVersion");
CREATE INDEX "FotorankCompetitiveEligibilityFreeze_contestId_status_idx" ON "FotorankCompetitiveEligibilityFreeze"("contestId", "status");
CREATE INDEX "FotorankCompetitiveEligibilityFreeze_admissionBatchId_idx" ON "FotorankCompetitiveEligibilityFreeze"("admissionBatchId");

ALTER TABLE "FotorankCompetitiveEligibilityFreeze" ADD CONSTRAINT "FotorankCompetitiveEligibilityFreeze_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankCompetitiveEligibilityFreeze" ADD CONSTRAINT "FotorankCompetitiveEligibilityFreeze_admissionBatchId_fkey" FOREIGN KEY ("admissionBatchId") REFERENCES "FotorankAdmissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) FotorankJuryActivityHeartbeat — tiempo activo / ETA (§7.7 master rules). No es evaluación de desempeño.
CREATE TABLE "FotorankJuryActivityHeartbeat" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "scoringSessionId" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,
    "activeSecondsAccumulated" INTEGER NOT NULL DEFAULT 0,
    "idleThresholdSeconds" INTEGER NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotorankJuryActivityHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankJuryActivityHeartbeat_contestId_jurorId_key" ON "FotorankJuryActivityHeartbeat"("contestId", "jurorId");
CREATE INDEX "FotorankJuryActivityHeartbeat_scoringSessionId_idx" ON "FotorankJuryActivityHeartbeat"("scoringSessionId");

ALTER TABLE "FotorankJuryActivityHeartbeat" ADD CONSTRAINT "FotorankJuryActivityHeartbeat_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryActivityHeartbeat" ADD CONSTRAINT "FotorankJuryActivityHeartbeat_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankJuryActivityHeartbeat" ADD CONSTRAINT "FotorankJuryActivityHeartbeat_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
