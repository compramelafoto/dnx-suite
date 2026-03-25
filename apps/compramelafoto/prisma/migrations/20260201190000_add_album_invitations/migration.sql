-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AlbumInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AlbumAccessRole" AS ENUM ('VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (IF NOT EXISTS para compatibilidad con baseline)
CREATE TABLE IF NOT EXISTS "AlbumInvitation" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "AlbumInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" INTEGER,

    CONSTRAINT "AlbumInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlbumAccess" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "AlbumAccessRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS para compatibilidad)
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumInvitation_tokenHash_key" ON "AlbumInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "AlbumInvitation_albumId_idx" ON "AlbumInvitation"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumInvitation_invitedEmail_idx" ON "AlbumInvitation"("invitedEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumAccess_albumId_userId_key" ON "AlbumAccess"("albumId", "userId");
CREATE INDEX IF NOT EXISTS "AlbumAccess_albumId_idx" ON "AlbumAccess"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumAccess_userId_idx" ON "AlbumAccess"("userId");

-- AddForeignKey (ignorar si ya existen por baseline)
DO $$ BEGIN
  ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AlbumInvitation" ADD CONSTRAINT "AlbumInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AlbumAccess" ADD CONSTRAINT "AlbumAccess_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AlbumAccess" ADD CONSTRAINT "AlbumAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
