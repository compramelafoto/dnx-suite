-- CreateEnum
CREATE TYPE "DnxCommunicationWebhookStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSED', 'IGNORED', 'DUPLICATE', 'FAILED');

-- CreateTable
CREATE TABLE "DnxCommunicationWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "rawEventType" TEXT NOT NULL,
    "normalizedEventType" TEXT,
    "status" "DnxCommunicationWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "recipientMasked" TEXT,
    "recipientHash" TEXT,
    "safeLinkHost" TEXT,
    "safeLinkPath" TEXT,
    "failureCategory" TEXT,
    "failureReasonCode" TEXT,
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "productEffectsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxCommunicationWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DnxCommunicationWebhookEvent_provider_providerEventId_key" ON "DnxCommunicationWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "DnxCommunicationWebhookEvent_status_receivedAt_idx" ON "DnxCommunicationWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "DnxCommunicationWebhookEvent_provider_normalizedEventType_idx" ON "DnxCommunicationWebhookEvent"("provider", "normalizedEventType");

-- CreateIndex
CREATE INDEX "DnxCommunicationWebhookEvent_providerMessageId_idx" ON "DnxCommunicationWebhookEvent"("providerMessageId");
