-- AlterTable
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable (IF NOT EXISTS para compatibilidad con baseline/shadow DB)
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "reactivatedAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "reactivationCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill expiresAt based on created/firstPhotoDate
UPDATE "Album"
SET "expiresAt" = COALESCE("firstPhotoDate", "createdAt") + INTERVAL '30 days';

-- AlterTable (IF NOT EXISTS para compatibilidad con baseline/shadow DB)
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP(3);
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "nextEmailAt" TIMESTAMP(3);
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "hasPurchased" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE01" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE02" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE03" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE04" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE05" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE06" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE07" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "sentE08" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex (IF NOT EXISTS para compatibilidad)
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumInterest_albumId_email_key" ON "AlbumInterest"("albumId", "email");
CREATE INDEX IF NOT EXISTS "AlbumInterest_albumId_idx" ON "AlbumInterest"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumInterest_email_idx" ON "AlbumInterest"("email");

-- CreateTable (IF NOT EXISTS para compatibilidad con baseline/shadow DB)
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SentEmailLog" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "albumId" INTEGER,

    CONSTRAINT "SentEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminSystemMessage" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSystemMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserLoginDevice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS para compatibilidad)
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX IF NOT EXISTS "SentEmailLog_to_idx" ON "SentEmailLog"("to");
CREATE INDEX IF NOT EXISTS "SentEmailLog_templateKey_idx" ON "SentEmailLog"("templateKey");
CREATE INDEX IF NOT EXISTS "SentEmailLog_createdAt_idx" ON "SentEmailLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminSystemMessage_type_idx" ON "AdminSystemMessage"("type");
CREATE INDEX IF NOT EXISTS "AdminSystemMessage_isRead_idx" ON "AdminSystemMessage"("isRead");
CREATE INDEX IF NOT EXISTS "AdminSystemMessage_createdAt_idx" ON "AdminSystemMessage"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UserLoginDevice_userId_deviceHash_key" ON "UserLoginDevice"("userId", "deviceHash");
CREATE INDEX IF NOT EXISTS "UserLoginDevice_userId_idx" ON "UserLoginDevice"("userId");
CREATE INDEX IF NOT EXISTS "UserLoginDevice_lastSeenAt_idx" ON "UserLoginDevice"("lastSeenAt");

-- AddForeignKey (ignorar si ya existe por baseline)
DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "UserLoginDevice" ADD CONSTRAINT "UserLoginDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
