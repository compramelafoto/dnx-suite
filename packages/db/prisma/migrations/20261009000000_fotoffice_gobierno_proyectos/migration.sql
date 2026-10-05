-- CreateTable
CREATE TABLE "GovProjectType" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "templateKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectTypeStage" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GovProjectTypeStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectTypeTask" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GovProjectTypeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProject" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "typeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "origin" TEXT NOT NULL DEFAULT 'COMMISSION',
    "statusReason" TEXT,
    "proposedByMemberId" TEXT,
    "responsibleMemberId" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "visibleToMembers" BOOLEAN NOT NULL DEFAULT false,
    "manualNeededArs" DECIMAL(12,2),
    "openingAssignedArs" DECIMAL(12,2),
    "openingSpentArs" DECIMAL(12,2),
    "openingAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostArs" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "assigneeMemberId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notDoneReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovTaskUpdate" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "authorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovTaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovAttachment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskUpdateId" TEXT,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "visibleToMembers" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "data" JSONB,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovProjectType_workspaceId_order_idx" ON "GovProjectType"("workspaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "GovProjectType_workspaceId_name_key" ON "GovProjectType"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "GovProjectTypeStage_typeId_order_idx" ON "GovProjectTypeStage"("typeId", "order");

-- CreateIndex
CREATE INDEX "GovProjectTypeTask_stageId_order_idx" ON "GovProjectTypeTask"("stageId", "order");

-- CreateIndex
CREATE INDEX "GovProject_workspaceId_status_idx" ON "GovProject"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "GovProject_workspaceId_deadlineAt_idx" ON "GovProject"("workspaceId", "deadlineAt");

-- CreateIndex
CREATE INDEX "GovProjectStage_projectId_order_idx" ON "GovProjectStage"("projectId", "order");

-- CreateIndex
CREATE INDEX "GovProjectTask_projectId_stageId_order_idx" ON "GovProjectTask"("projectId", "stageId", "order");

-- CreateIndex
CREATE INDEX "GovProjectTask_assigneeMemberId_status_idx" ON "GovProjectTask"("assigneeMemberId", "status");

-- CreateIndex
CREATE INDEX "GovTaskUpdate_taskId_createdAt_idx" ON "GovTaskUpdate"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovAttachment_r2Key_key" ON "GovAttachment"("r2Key");

-- CreateIndex
CREATE INDEX "GovAttachment_projectId_createdAt_idx" ON "GovAttachment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GovAttachment_taskUpdateId_idx" ON "GovAttachment"("taskUpdateId");

-- CreateIndex
CREATE INDEX "GovProjectEvent_projectId_createdAt_idx" ON "GovProjectEvent"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "GovProjectType" ADD CONSTRAINT "GovProjectType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectTypeStage" ADD CONSTRAINT "GovProjectTypeStage_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GovProjectType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectTypeTask" ADD CONSTRAINT "GovProjectTypeTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "GovProjectTypeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProject" ADD CONSTRAINT "GovProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProject" ADD CONSTRAINT "GovProject_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GovProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProject" ADD CONSTRAINT "GovProject_proposedByMemberId_fkey" FOREIGN KEY ("proposedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProject" ADD CONSTRAINT "GovProject_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectStage" ADD CONSTRAINT "GovProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectTask" ADD CONSTRAINT "GovProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectTask" ADD CONSTRAINT "GovProjectTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "GovProjectStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectTask" ADD CONSTRAINT "GovProjectTask_assigneeMemberId_fkey" FOREIGN KEY ("assigneeMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovTaskUpdate" ADD CONSTRAINT "GovTaskUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GovProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovAttachment" ADD CONSTRAINT "GovAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovAttachment" ADD CONSTRAINT "GovAttachment_taskUpdateId_fkey" FOREIGN KEY ("taskUpdateId") REFERENCES "GovTaskUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovProjectEvent" ADD CONSTRAINT "GovProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

