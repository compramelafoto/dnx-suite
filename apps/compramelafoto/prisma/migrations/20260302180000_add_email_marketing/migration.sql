-- Add marketing and unsubscribe fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

-- Create unique index for unsubscribeToken (PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "User_unsubscribeToken_key" ON "User"("unsubscribeToken") WHERE "unsubscribeToken" IS NOT NULL;

-- Create enum types for email marketing
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELED');
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED');

-- Create EmailCampaign table
CREATE TABLE "EmailCampaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceJson" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- Create EmailSend table
CREATE TABLE "EmailSend" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toUserId" INTEGER,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX "EmailCampaign_createdAt_idx" ON "EmailCampaign"("createdAt");
CREATE INDEX "EmailSend_campaignId_idx" ON "EmailSend"("campaignId");
CREATE INDEX "EmailSend_status_idx" ON "EmailSend"("status");
CREATE INDEX "EmailSend_createdAt_idx" ON "EmailSend"("createdAt");

-- Add foreign key
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
