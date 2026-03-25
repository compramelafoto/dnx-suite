-- Álbum: fotos ocultas hasta selfie + retención de selfie
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "hiddenPhotosEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "hiddenSelfieRetentionDays" INTEGER;

-- Enums para auditoría de selfie (álbum oculto)
CREATE TYPE "HiddenAlbumAttemptResult" AS ENUM ('NO_FACE', 'MULTIPLE_FACES', 'MATCH_FOUND', 'NO_MATCH', 'EXPIRED_SESSION', 'RATE_LIMITED', 'ERROR');
CREATE TYPE "HiddenAlbumDeviceType" AS ENUM ('MOBILE', 'DESKTOP', 'UNKNOWN');

-- Registro de cada intento de selfie (auditoría)
CREATE TABLE IF NOT EXISTS "HiddenAlbumAttempt" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "guestId" TEXT,
    "qrSessionId" TEXT,
    "ipHash" TEXT,
    "userAgent" VARCHAR(1024),
    "deviceType" "HiddenAlbumDeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "result" "HiddenAlbumAttemptResult" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(512),
    "facesInSelfieCount" INTEGER NOT NULL DEFAULT 0,
    "bestMatchConfidence" DOUBLE PRECISION,
    "matchedFacesCount" INTEGER NOT NULL DEFAULT 0,
    "photosNoFaceCount" INTEGER NOT NULL DEFAULT 0,
    "photosMatchedCount" INTEGER NOT NULL DEFAULT 0,
    "photosVisibleTotal" INTEGER NOT NULL DEFAULT 0,
    "selfieStored" BOOLEAN NOT NULL DEFAULT false,
    "selfieObjectKey" TEXT,
    "selfieExpiresAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "HiddenAlbumAttempt_pkey" PRIMARY KEY ("id")
);

-- Autorización post-selfie (fotos que el usuario puede ver)
CREATE TABLE IF NOT EXISTS "HiddenAlbumGrant" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,
    "guestId" TEXT,
    "attemptId" TEXT NOT NULL,
    "allowedPhotoIds" JSONB NOT NULL,
    "allowedCount" INTEGER NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HiddenAlbumGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HiddenAlbumGrant_attemptId_key" ON "HiddenAlbumGrant"("attemptId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_albumId_idx" ON "HiddenAlbumAttempt"("albumId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_createdAt_idx" ON "HiddenAlbumAttempt"("createdAt");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_userId_idx" ON "HiddenAlbumAttempt"("userId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_guestId_idx" ON "HiddenAlbumAttempt"("guestId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_result_idx" ON "HiddenAlbumAttempt"("result");
CREATE INDEX IF NOT EXISTS "HiddenAlbumAttempt_qrSessionId_idx" ON "HiddenAlbumAttempt"("qrSessionId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumGrant_albumId_idx" ON "HiddenAlbumGrant"("albumId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumGrant_expiresAt_idx" ON "HiddenAlbumGrant"("expiresAt");
CREATE INDEX IF NOT EXISTS "HiddenAlbumGrant_userId_idx" ON "HiddenAlbumGrant"("userId");
CREATE INDEX IF NOT EXISTS "HiddenAlbumGrant_guestId_idx" ON "HiddenAlbumGrant"("guestId");

ALTER TABLE "HiddenAlbumAttempt" DROP CONSTRAINT IF EXISTS "HiddenAlbumAttempt_albumId_fkey";
ALTER TABLE "HiddenAlbumAttempt" ADD CONSTRAINT "HiddenAlbumAttempt_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiddenAlbumGrant" DROP CONSTRAINT IF EXISTS "HiddenAlbumGrant_albumId_fkey";
ALTER TABLE "HiddenAlbumGrant" ADD CONSTRAINT "HiddenAlbumGrant_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HiddenAlbumGrant" DROP CONSTRAINT IF EXISTS "HiddenAlbumGrant_attemptId_fkey";
ALTER TABLE "HiddenAlbumGrant" ADD CONSTRAINT "HiddenAlbumGrant_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "HiddenAlbumAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
