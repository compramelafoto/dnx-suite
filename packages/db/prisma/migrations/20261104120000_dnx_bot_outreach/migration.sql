-- DNX Bot etapa 2: saludos (globito del panel) y mails de campaña. Idempotente.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BotOutreachChannel" AS ENUM ('PANEL', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BotOutreachStatus" AS ENUM ('SHOWN', 'CLICKED', 'DISMISSED', 'DECLINED', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotOutreach" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "campaign" TEXT NOT NULL,
    "channel" "BotOutreachChannel" NOT NULL,
    "status" "BotOutreachStatus" NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotOutreach_platform_campaign_status_idx" ON "BotOutreach"("platform", "campaign", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotOutreach_platform_userId_campaign_channel_key" ON "BotOutreach"("platform", "userId", "campaign", "channel");
