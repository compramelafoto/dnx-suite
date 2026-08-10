-- ETAPA 17B — SocialConnection + PublicVotePublication (aditivo; mock Instagram provider).
-- No activa votación comercial ni publicaciones reales.

ALTER TABLE "FotorankPublicVoteRound"
  ADD COLUMN IF NOT EXISTS "socialConnectionId" TEXT,
  ADD COLUMN IF NOT EXISTS "pollingMode" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "incidentStatus" TEXT;

CREATE TABLE IF NOT EXISTS "FotorankSocialConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "accountId" TEXT NOT NULL,
    "accountUsername" TEXT,
    "accountType" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'CONNECTED',
    "permissionsJson" JSONB,
    "tokenReference" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "connectedByUserId" INTEGER,
    "lastValidatedAt" TIMESTAMP(3),
    "health" TEXT NOT NULL DEFAULT 'CONNECTED',
    "rateLimitStateJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotorankSocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotorankPublicVotePublication" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "socialConnectionId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "externalMediaId" TEXT,
    "externalContainerId" TEXT,
    "permalink" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publicationStatus" TEXT NOT NULL DEFAULT 'PREPARED',
    "publicationType" TEXT NOT NULL DEFAULT 'IMAGE',
    "captionSnapshot" TEXT,
    "assetSnapshotJson" JSONB,
    "socialAssetHash" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failedReason" TEXT,
    "providerMetadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotorankPublicVotePublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankSocialConnection_organizationId_provider_accountId_key"
  ON "FotorankSocialConnection"("organizationId", "provider", "accountId");

CREATE INDEX IF NOT EXISTS "FotorankSocialConnection_organizationId_provider_idx"
  ON "FotorankSocialConnection"("organizationId", "provider");

CREATE INDEX IF NOT EXISTS "FotorankSocialConnection_connectionStatus_idx"
  ON "FotorankSocialConnection"("connectionStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVotePublication_idempotencyKey_key"
  ON "FotorankPublicVotePublication"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankPublicVotePublication_roundId_candidateId_key"
  ON "FotorankPublicVotePublication"("roundId", "candidateId");

CREATE INDEX IF NOT EXISTS "FotorankPublicVotePublication_roundId_publicationStatus_idx"
  ON "FotorankPublicVotePublication"("roundId", "publicationStatus");

CREATE INDEX IF NOT EXISTS "FotorankPublicVotePublication_socialConnectionId_idx"
  ON "FotorankPublicVotePublication"("socialConnectionId");

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVoteRound"
    ADD CONSTRAINT "FotorankPublicVoteRound_socialConnectionId_fkey"
    FOREIGN KEY ("socialConnectionId") REFERENCES "FotorankSocialConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankSocialConnection"
    ADD CONSTRAINT "FotorankSocialConnection_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankSocialConnection"
    ADD CONSTRAINT "FotorankSocialConnection_connectedByUserId_fkey"
    FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVotePublication"
    ADD CONSTRAINT "FotorankPublicVotePublication_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "FotorankPublicVoteRound"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVotePublication"
    ADD CONSTRAINT "FotorankPublicVotePublication_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "FotorankPublicVoteCandidate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FotorankPublicVotePublication"
    ADD CONSTRAINT "FotorankPublicVotePublication_socialConnectionId_fkey"
    FOREIGN KEY ("socialConnectionId") REFERENCES "FotorankSocialConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
