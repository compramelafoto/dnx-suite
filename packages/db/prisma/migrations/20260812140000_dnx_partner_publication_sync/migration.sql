-- DNX Partners ETAPA 08 Imp 02 — multi-app targets + publication sync status.

CREATE TYPE "DnxPartnerCampaignTargetStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "DnxPartnerPublicationEntityType" AS ENUM ('CAMPAIGN');
CREATE TYPE "DnxPartnerPublicationSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED');

CREATE TABLE "DnxPartnerCampaignTarget" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "application" "DnxPartnerApplication" NOT NULL,
  "status" "DnxPartnerCampaignTargetStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPartnerCampaignTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartnerCampaignTarget_campaignId_application_key"
  ON "DnxPartnerCampaignTarget"("campaignId", "application");
CREATE INDEX "DnxPartnerCampaignTarget_application_status_idx"
  ON "DnxPartnerCampaignTarget"("application", "status");

ALTER TABLE "DnxPartnerCampaignTarget"
  ADD CONSTRAINT "DnxPartnerCampaignTarget_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DnxPartnerPublicationSync" (
  "id" TEXT NOT NULL,
  "entityType" "DnxPartnerPublicationEntityType" NOT NULL DEFAULT 'CAMPAIGN',
  "sourceEntityId" TEXT NOT NULL,
  "campaignId" TEXT,
  "targetApplication" "DnxPartnerApplication" NOT NULL,
  "targetDatabaseKey" VARCHAR(40) NOT NULL,
  "sourceVersion" VARCHAR(64) NOT NULL,
  "targetVersion" VARCHAR(64),
  "status" "DnxPartnerPublicationSyncStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPartnerPublicationSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxPartnerPublicationSync_entityType_sourceEntityId_targetApplication_key"
  ON "DnxPartnerPublicationSync"("entityType", "sourceEntityId", "targetApplication");
CREATE INDEX "DnxPartnerPublicationSync_status_updatedAt_idx"
  ON "DnxPartnerPublicationSync"("status", "updatedAt");
CREATE INDEX "DnxPartnerPublicationSync_targetApplication_status_idx"
  ON "DnxPartnerPublicationSync"("targetApplication", "status");
CREATE INDEX "DnxPartnerPublicationSync_campaignId_idx"
  ON "DnxPartnerPublicationSync"("campaignId");

ALTER TABLE "DnxPartnerPublicationSync"
  ADD CONSTRAINT "DnxPartnerPublicationSync_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DnxPartnerCampaign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
