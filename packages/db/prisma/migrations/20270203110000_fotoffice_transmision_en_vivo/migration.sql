-- Transmisión en vivo (módulo `live`): el canal de cada workspace en Cloudflare Stream
-- (FotofficeLiveChannel), cada vivo (FotofficeLiveSession) y sus grabaciones
-- (FotofficeLiveRecording). Todo aditivo: tres enums y tres tablas nuevas; no toca ninguna
-- tabla existente.
-- Idempotente: se puede correr dos veces.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FotofficeLiveVisibility" AS ENUM ('PUBLICA', 'SOCIOS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FotofficeLiveSessionStatus" AS ENUM ('ESPERANDO_SENAL', 'EN_VIVO', 'SENAL_CORTADA', 'TERMINADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FotofficeLiveRecordingStatus" AS ENUM ('PROCESANDO', 'LISTA', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeLiveChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "liveInputUid" TEXT NOT NULL,
    "rtmpsUrl" TEXT NOT NULL,
    "srtUrl" TEXT,
    "youtubeKeyCiphertext" TEXT,
    "youtubeKeyNonce" TEXT,
    "youtubeKeyAuthTag" TEXT,
    "youtubeKeyVersion" TEXT,
    "youtubeKeyLast4" TEXT,
    "tiktokServerUrl" TEXT,
    "tiktokKeyCiphertext" TEXT,
    "tiktokKeyNonce" TEXT,
    "tiktokKeyAuthTag" TEXT,
    "tiktokKeyVersion" TEXT,
    "tiktokKeyLast4" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeLiveChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeLiveSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" "FotofficeLiveVisibility" NOT NULL DEFAULT 'SOCIOS',
    "status" "FotofficeLiveSessionStatus" NOT NULL DEFAULT 'ESPERANDO_SENAL',
    "destinations" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastSignalAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeLiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeLiveRecording" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "videoUid" TEXT NOT NULL,
    "status" "FotofficeLiveRecordingStatus" NOT NULL DEFAULT 'PROCESANDO',
    "durationSeconds" INTEGER,
    "thumbnailUrl" TEXT,
    "recordedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "publishedCourseId" TEXT,
    "publishedLessonId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeLiveRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeLiveChannel_workspaceId_key" ON "FotofficeLiveChannel"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeLiveChannel_liveInputUid_key" ON "FotofficeLiveChannel"("liveInputUid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeLiveSession_workspaceId_createdAt_idx" ON "FotofficeLiveSession"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeLiveSession_channelId_status_idx" ON "FotofficeLiveSession"("channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeLiveRecording_videoUid_key" ON "FotofficeLiveRecording"("videoUid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeLiveRecording_workspaceId_createdAt_idx" ON "FotofficeLiveRecording"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeLiveRecording_sessionId_idx" ON "FotofficeLiveRecording"("sessionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeLiveSession" ADD CONSTRAINT "FotofficeLiveSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "FotofficeLiveChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeLiveRecording" ADD CONSTRAINT "FotofficeLiveRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FotofficeLiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
