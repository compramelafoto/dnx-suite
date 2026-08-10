-- ETAPA 16B — Core domain: finalistas (§8 master rules) y preparación de voto público (§9–§10).
-- 100% aditivo. Reutiliza FotorankCompetitionJuryConfig existente para campos de voto público
-- (sin tabla nueva de config). NO activa jurado, resultados ni votación pública en ningún concurso.

-- 1) FotorankCompetitionJuryConfig — preparación de voto público (§9–§10 master rules).
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteUnit" TEXT NOT NULL DEFAULT 'PROMPT';
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteMetric" TEXT NOT NULL DEFAULT 'LIKE_COUNT';
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteDurationMinutes" INTEGER NOT NULL DEFAULT 1440;
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteStartsAt" TIMESTAMP(3);
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteEndsAt" TIMESTAMP(3);
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteProvider" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicVoteStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED';
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "publicTieBreakMode" TEXT NOT NULL DEFAULT 'PUBLIC_TIEBREAK';
ALTER TABLE "FotorankCompetitionJuryConfig" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

-- 2) FotorankFinalistSnapshot — ítem inmutable del paquete de finalistas (§8 master rules).
-- internalJuryRank es orden INTERNO de jurado (1..N por consigna); NUNCA la posición pública definitiva.
CREATE TABLE "FotorankFinalistSnapshot" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "scoringSessionId" TEXT NOT NULL,
    "resultBatchId" TEXT,
    "promptExternalId" TEXT NOT NULL,
    "promptSequence" INTEGER,
    "entryId" TEXT,
    "juryEntrySnapshotId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "internalJuryRank" INTEGER NOT NULL,
    "aggregateScore" DOUBLE PRECISION,
    "normalizedScore" DOUBLE PRECISION,
    "derivativeAssetKey" TEXT,
    "derivativeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "packageHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotorankFinalistSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankFinalistSnapshot_contestId_promptExternalId_publi_key" ON "FotorankFinalistSnapshot"("contestId", "promptExternalId", "publicCode");
CREATE INDEX "FotorankFinalistSnapshot_contestId_status_idx" ON "FotorankFinalistSnapshot"("contestId", "status");
CREATE INDEX "FotorankFinalistSnapshot_scoringSessionId_idx" ON "FotorankFinalistSnapshot"("scoringSessionId");
CREATE INDEX "FotorankFinalistSnapshot_juryEntrySnapshotId_idx" ON "FotorankFinalistSnapshot"("juryEntrySnapshotId");
CREATE INDEX "FotorankFinalistSnapshot_resultBatchId_idx" ON "FotorankFinalistSnapshot"("resultBatchId");

ALTER TABLE "FotorankFinalistSnapshot" ADD CONSTRAINT "FotorankFinalistSnapshot_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankFinalistSnapshot" ADD CONSTRAINT "FotorankFinalistSnapshot_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankFinalistSnapshot" ADD CONSTRAINT "FotorankFinalistSnapshot_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "FotorankResultBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankFinalistSnapshot" ADD CONSTRAINT "FotorankFinalistSnapshot_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FotorankFinalistSnapshot" ADD CONSTRAINT "FotorankFinalistSnapshot_juryEntrySnapshotId_fkey" FOREIGN KEY ("juryEntrySnapshotId") REFERENCES "FotorankJuryEntrySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) FotorankFinalistPackage — sobre de confirmación (§8 master rules). Confirmar = inmutable.
CREATE TABLE "FotorankFinalistPackage" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "scoringSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "positionsCount" INTEGER NOT NULL DEFAULT 0,
    "confirmHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" INTEGER,
    "readinessJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotorankFinalistPackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankFinalistPackage_contestId_status_idx" ON "FotorankFinalistPackage"("contestId", "status");
CREATE INDEX "FotorankFinalistPackage_scoringSessionId_idx" ON "FotorankFinalistPackage"("scoringSessionId");

ALTER TABLE "FotorankFinalistPackage" ADD CONSTRAINT "FotorankFinalistPackage_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotorankFinalistPackage" ADD CONSTRAINT "FotorankFinalistPackage_scoringSessionId_fkey" FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
