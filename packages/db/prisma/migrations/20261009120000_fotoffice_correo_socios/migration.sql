-- Correo a socios (Comunicación → Correo): interruptores, envíos, destinatarios y bajas.
-- Sólo tablas nuevas: no toca ninguna existente.
CREATE TABLE "FotofficeMailingSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "bulkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyBlogDigest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeMailingSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeMailingSettings_workspaceId_key" ON "FotofficeMailingSettings"("workspaceId");

CREATE TABLE "FotofficeEmailCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "blogPostId" INTEGER,
    "blogPostIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "recipientsTotal" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "optedOutCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "FotofficeEmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeEmailCampaign_dedupeKey_key" ON "FotofficeEmailCampaign"("dedupeKey");
CREATE INDEX "FotofficeEmailCampaign_workspaceId_createdAt_idx" ON "FotofficeEmailCampaign"("workspaceId", "createdAt");
CREATE INDEX "FotofficeEmailCampaign_status_idx" ON "FotofficeEmailCampaign"("status");

CREATE TABLE "FotofficeEmailDelivery" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "memberId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "resendId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeEmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeEmailDelivery_campaignId_email_key" ON "FotofficeEmailDelivery"("campaignId", "email");
CREATE INDEX "FotofficeEmailDelivery_campaignId_status_idx" ON "FotofficeEmailDelivery"("campaignId", "status");
ALTER TABLE "FotofficeEmailDelivery" ADD CONSTRAINT "FotofficeEmailDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FotofficeEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FotofficeEmailOptOut" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeEmailOptOut_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeEmailOptOut_workspaceId_email_topic_key" ON "FotofficeEmailOptOut"("workspaceId", "email", "topic");
