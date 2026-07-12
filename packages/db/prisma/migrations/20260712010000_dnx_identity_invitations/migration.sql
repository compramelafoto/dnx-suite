-- DNX Identity: invitaciones suite-wide + rol Info Spot colaborador

-- ---------------------------------------------------------------------------
-- Info Spot: nuevo rol COLABORADOR
-- ---------------------------------------------------------------------------
ALTER TYPE "InfoSpotEditorialRole" ADD VALUE IF NOT EXISTS 'INFOSPOT_COLABORADOR';

-- ---------------------------------------------------------------------------
-- Invitaciones de identidad (reutilizable por app)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "DnxInvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DnxAppInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "appRole" TEXT NOT NULL,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "status" "DnxInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxAppInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DnxAppInvitation_tokenHash_key" ON "DnxAppInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "DnxAppInvitation_email_app_status_idx" ON "DnxAppInvitation"("email", "app", "status");
CREATE INDEX IF NOT EXISTS "DnxAppInvitation_expiresAt_idx" ON "DnxAppInvitation"("expiresAt");
CREATE INDEX IF NOT EXISTS "DnxAppInvitation_invitedByUserId_idx" ON "DnxAppInvitation"("invitedByUserId");

DO $$ BEGIN
  ALTER TABLE "DnxAppInvitation"
    ADD CONSTRAINT "DnxAppInvitation_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DnxAppInvitation"
    ADD CONSTRAINT "DnxAppInvitation_acceptedUserId_fkey"
    FOREIGN KEY ("acceptedUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
