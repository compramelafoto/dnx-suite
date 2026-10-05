-- Correo a socios, etapa 4: campañas libres, aprobación y métricas.
ALTER TABLE "FotofficeMailingSettings" ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotofficeEmailCampaign" ADD COLUMN "messageId" TEXT;
ALTER TABLE "FotofficeEmailDelivery" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "FotofficeEmailDelivery" ADD COLUMN "openedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeEmailDelivery" ADD COLUMN "clickedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeEmailDelivery" ADD COLUMN "bouncedAt" TIMESTAMP(3);
ALTER TABLE "FotofficeEmailDelivery" ADD COLUMN "complainedAt" TIMESTAMP(3);
CREATE INDEX "FotofficeEmailDelivery_resendId_idx" ON "FotofficeEmailDelivery"("resendId");

CREATE TABLE "FotofficeMailingMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "approvalRequestedAt" TIMESTAMP(3),
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeMailingMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeMailingMessage_workspaceId_createdAt_idx" ON "FotofficeMailingMessage"("workspaceId", "createdAt");
CREATE INDEX "FotofficeMailingMessage_status_scheduledAt_idx" ON "FotofficeMailingMessage"("status", "scheduledAt");
