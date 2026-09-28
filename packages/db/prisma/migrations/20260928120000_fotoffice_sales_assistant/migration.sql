-- Asistente de ventas de FOTOFFICE (etapa 1). Aditiva: cuatro tablas nuevas, nada existente cambia.
-- Se aplica a mano en las cinco bases y se registra con `prisma migrate resolve --applied`.

-- CreateTable
CREATE TABLE "FotofficeSalesSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pipelinesIncluded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signature" TEXT,
    "voiceNotes" TEXT,
    "waitDays" INTEGER NOT NULL DEFAULT 3,
    "staleDays" INTEGER NOT NULL DEFAULT 120,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSalesSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeSalesOpportunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "eventType" TEXT,
    "eventDate" TIMESTAMP(3),
    "pipelineName" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "quoteSentAt" TIMESTAMP(3),
    "externalCreatedAt" TIMESTAMP(3) NOT NULL,
    "externalModifiedAt" TIMESTAMP(3) NOT NULL,
    "externalStatus" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSalesOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeSalesSuggestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "editedMessage" TEXT,
    "waitUntil" TIMESTAMP(3),
    "opportunityModifiedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FotofficeSalesSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeSalesFollowUp" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "suggestionId" TEXT,
    "kind" TEXT NOT NULL,
    "outcome" TEXT,
    "text" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeSalesFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeSalesSettings_workspaceId_key" ON "FotofficeSalesSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeSalesOpportunity_workspaceId_externalStatus_idx" ON "FotofficeSalesOpportunity"("workspaceId", "externalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeSalesOpportunity_workspaceId_source_externalId_key" ON "FotofficeSalesOpportunity"("workspaceId", "source", "externalId");

-- CreateIndex
CREATE INDEX "FotofficeSalesSuggestion_workspaceId_status_idx" ON "FotofficeSalesSuggestion"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FotofficeSalesSuggestion_opportunityId_createdAt_idx" ON "FotofficeSalesSuggestion"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeSalesFollowUp_opportunityId_createdAt_idx" ON "FotofficeSalesFollowUp"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeSalesFollowUp_workspaceId_idx" ON "FotofficeSalesFollowUp"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeSalesSettings" ADD CONSTRAINT "FotofficeSalesSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSalesOpportunity" ADD CONSTRAINT "FotofficeSalesOpportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSalesSuggestion" ADD CONSTRAINT "FotofficeSalesSuggestion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FotofficeSalesOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSalesFollowUp" ADD CONSTRAINT "FotofficeSalesFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FotofficeSalesOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSalesFollowUp" ADD CONSTRAINT "FotofficeSalesFollowUp_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "FotofficeSalesSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
