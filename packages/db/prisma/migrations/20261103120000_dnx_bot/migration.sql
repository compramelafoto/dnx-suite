-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BotConversationStatus" AS ENUM ('OPEN', 'ESCALATED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BotActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'REJECTED', 'EXPIRED', 'UNDONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "BotIncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'FIXED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotConversation" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" INTEGER,
    "pagePath" TEXT,
    "status" "BotConversationStatus" NOT NULL DEFAULT 'OPEN',
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "supportTicketId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "platform" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "BotActionStatus" NOT NULL DEFAULT 'PENDING',
    "before" JSONB,
    "after" JSONB,
    "resultMessage" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotIncident" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" "BotIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "prUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BotUsageDaily" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BotUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotConversation_userId_updatedAt_idx" ON "BotConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotConversation_createdAt_idx" ON "BotConversation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotMessage_conversationId_seq_key" ON "BotMessage"("conversationId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotAction_userId_createdAt_idx" ON "BotAction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotAction_status_expiresAt_idx" ON "BotAction"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotIncident_status_lastSeenAt_idx" ON "BotIncident"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotIncident_platform_signature_key" ON "BotIncident"("platform", "signature");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BotUsageDaily_platform_day_idx" ON "BotUsageDaily"("platform", "day");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BotUsageDaily_platform_day_userId_key" ON "BotUsageDaily"("platform", "day", "userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BotConversation" ADD CONSTRAINT "BotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BotMessage" ADD CONSTRAINT "BotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "BotAction" ADD CONSTRAINT "BotAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "BotConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

