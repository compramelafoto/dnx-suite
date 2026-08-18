-- ETAPA 17A — Motor genérico de votación pública (aditivo; TestProvider only).
-- No activa Instagram ni votación comercial.

ALTER TABLE "FotorankCompetitionJuryConfig"
  ADD COLUMN IF NOT EXISTS "publicVoteCutoffPolicy" TEXT NOT NULL DEFAULT 'LAST_VALID_OBSERVATION_BEFORE_CUTOFF',
  ADD COLUMN IF NOT EXISTS "resultsPublicationMode" TEXT NOT NULL DEFAULT 'CALCULATED',
  ADD COLUMN IF NOT EXISTS "publicVoteStaleThresholdMinutes" INTEGER NOT NULL DEFAULT 30;

-- Align default tie-break naming (PUBLIC_REVOTE) without rewriting existing rows forcibly.
-- Existing PUBLIC_TIEBREAK remains valid synonym in app layer.

CREATE TABLE IF NOT EXISTS "FotorankPublicVoteRound" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitType" TEXT NOT NULL DEFAULT 'PROMPT',
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "roundType" TEXT NOT NULL DEFAULT 'NORMAL',
    "parentRoundId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metric" TEXT NOT NULL DEFAULT 'LIKE_COUNT',
    "provider" TEXT NOT NULL DEFAULT 'TEST_PROVIDER',
    "cutoffPolicy" TEXT NOT NULL DEFAULT 'LAST_VALID_OBSERVATION_BEFORE_CUTOFF',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "finalSnapshotAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "extendedFromEndsAt" TIMESTAMP(3),
    "configHash" TEXT,
    "candidateSnapshotHash" TEXT,
    "finalSnapshotHash" TEXT,
    "staleThresholdMinutes" INTEGER NOT NULL DEFAULT 30,
    "resultsPublicationStatus" TEXT NOT NULL DEFAULT 'CALCULATED',
    "providerHealth" TEXT NOT NULL DEFAULT 'CONNECTED',
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotorankPublicVoteRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotorankPublicVoteCandidate" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "finalistSnapshotId" TEXT,
    "publicCode" TEXT NOT NULL,
    "entryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotorankPublicVoteCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotorankPublicVoteObservation" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "providerObservedAt" TIMESTAMP(3) NOT NULL,
    "providerMetricTimestamp" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'TEST_PROVIDER',
    "providerEventKey" TEXT NOT NULL,
    "rawHash" TEXT,
    "isDecreasing" BOOLEAN NOT NULL DEFAULT false,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    CONSTRAINT "FotorankPublicVoteObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotorankPublicVoteFinalSnapshot" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "finalMetricValue" DOUBLE PRECISION NOT NULL,
    "observationId" TEXT,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "providerObservedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalPosition" INTEGER,
    "integrityHash" TEXT NOT NULL,
    "metadataJson" JSONB,
    CONSTRAINT "FotorankPublicVoteFinalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVoteRound_contestId_unitKey_roundNumber_key"
  ON "FotorankPublicVoteRound"("contestId", "unitKey", "roundNumber");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteRound_contestId_status_idx"
  ON "FotorankPublicVoteRound"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteRound_contestId_unitKey_idx"
  ON "FotorankPublicVoteRound"("contestId", "unitKey");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteRound_parentRoundId_idx"
  ON "FotorankPublicVoteRound"("parentRoundId");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteRound_endsAt_status_idx"
  ON "FotorankPublicVoteRound"("endsAt", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVoteCandidate_roundId_publicCode_key"
  ON "FotorankPublicVoteCandidate"("roundId", "publicCode");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteCandidate_roundId_active_idx"
  ON "FotorankPublicVoteCandidate"("roundId", "active");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteCandidate_finalistSnapshotId_idx"
  ON "FotorankPublicVoteCandidate"("finalistSnapshotId");

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVoteObservation_roundId_providerEventKey_key"
  ON "FotorankPublicVoteObservation"("roundId", "providerEventKey");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteObservation_roundId_candidateId_providerObservedAt_idx"
  ON "FotorankPublicVoteObservation"("roundId", "candidateId", "providerObservedAt");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteObservation_candidateId_providerObservedAt_idx"
  ON "FotorankPublicVoteObservation"("candidateId", "providerObservedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVoteFinalSnapshot_roundId_candidateId_key"
  ON "FotorankPublicVoteFinalSnapshot"("roundId", "candidateId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVoteFinalSnapshot_roundId_publicCode_key"
  ON "FotorankPublicVoteFinalSnapshot"("roundId", "publicCode");
CREATE INDEX IF NOT EXISTS "FotorankPublicVoteFinalSnapshot_roundId_finalPosition_idx"
  ON "FotorankPublicVoteFinalSnapshot"("roundId", "finalPosition");

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteRound"
    ADD CONSTRAINT "FotorankPublicVoteRound_contestId_fkey"
    FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteRound"
    ADD CONSTRAINT "FotorankPublicVoteRound_parentRoundId_fkey"
    FOREIGN KEY ("parentRoundId") REFERENCES "FotorankPublicVoteRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteCandidate"
    ADD CONSTRAINT "FotorankPublicVoteCandidate_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "FotorankPublicVoteRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteObservation"
    ADD CONSTRAINT "FotorankPublicVoteObservation_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "FotorankPublicVoteRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteObservation"
    ADD CONSTRAINT "FotorankPublicVoteObservation_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "FotorankPublicVoteCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteFinalSnapshot"
    ADD CONSTRAINT "FotorankPublicVoteFinalSnapshot_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "FotorankPublicVoteRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteFinalSnapshot"
    ADD CONSTRAINT "FotorankPublicVoteFinalSnapshot_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "FotorankPublicVoteCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
