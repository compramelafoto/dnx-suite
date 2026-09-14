-- CreateTable
CREATE TABLE "CoverageSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleLabel" TEXT,
    "termRequest" TEXT,
    "termCollaborator" TEXT,
    "termRequester" TEXT,
    "termCall" TEXT,
    "assignmentMode" TEXT NOT NULL DEFAULT 'MIXTA',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requiresCoordinatorConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "reinforcementThresholdMinutes" INTEGER NOT NULL DEFAULT 180,
    "recommendedCollaborators" INTEGER NOT NULL DEFAULT 2,
    "roleTemplates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "zones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicFormEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicFormIntro" TEXT,
    "consentTextVersion" TEXT NOT NULL DEFAULT 'v1',
    "trackingLinkTtlDays" INTEGER NOT NULL DEFAULT 120,
    "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "tokenRevokedAt" TIMESTAMP(3),
    "eventTitle" TEXT NOT NULL,
    "eventDescription" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "activityKind" TEXT,
    "expectedAttendees" INTEGER,
    "venueKind" TEXT,
    "onSiteContactName" TEXT,
    "onSitePhone" TEXT,
    "mediaKinds" TEXT NOT NULL DEFAULT 'FOTO',
    "coverageKind" TEXT,
    "purpose" TEXT,
    "keyMoments" TEXT,
    "requestedPhotographers" INTEGER,
    "equipmentNotes" TEXT,
    "needsLighting" BOOLEAN NOT NULL DEFAULT false,
    "expectedDeliveryAt" TIMESTAMP(3),
    "deliveryChannel" TEXT,
    "notes" TEXT,
    "documentationLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "complexity" TEXT,
    "coordinatorUserId" INTEGER,
    "rejectionReason" TEXT,
    "infoRequested" TEXT,
    "resolvedByUserId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageConsent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "textVersion" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "CoverageConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANIFICADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRole" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "requirements" TEXT,
    "minExperience" TEXT,
    "equipmentRequired" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageCall" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicSummary" TEXT,
    "privateBriefing" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'TODOS',
    "visibilityValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicationsCloseAt" TIMESTAMP(3),
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageApplication" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "message" TEXT,
    "availabilityNote" TEXT,
    "equipmentNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECIBIDA',
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageAssignment" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "assignedByUserId" INTEGER,
    "criteria" TEXT,
    "respondBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PROPUESTA',
    "respondedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "replacedAssignmentId" TEXT,
    "hoursReported" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageDeliverable" (
    "id" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "responsibleMemberId" TEXT,
    "dueAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "url" TEXT,
    "notes" TEXT,
    "reviewNotes" TEXT,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageCollaboratorProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "homeCity" TEXT,
    "coverageZones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxTravelKm" INTEGER,
    "transport" TEXT,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceLevel" TEXT,
    "acceptsUrgent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageCollaboratorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverageSettings_workspaceId_key" ON "CoverageSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRequest_tokenHash_key" ON "CoverageRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "CoverageRequest_workspaceId_status_idx" ON "CoverageRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CoverageRequest_workspaceId_startsAt_idx" ON "CoverageRequest"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "CoverageRequest_workspaceId_createdAt_idx" ON "CoverageRequest"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CoverageRequest_clientId_idx" ON "CoverageRequest"("clientId");

-- CreateIndex
CREATE INDEX "CoverageRequest_tokenExpiresAt_idx" ON "CoverageRequest"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageRequest_workspaceId_publicCode_key" ON "CoverageRequest"("workspaceId", "publicCode");

-- CreateIndex
CREATE INDEX "CoverageConsent_requestId_idx" ON "CoverageConsent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageConsent_requestId_kind_key" ON "CoverageConsent"("requestId", "kind");

-- CreateIndex
CREATE INDEX "Coverage_workspaceId_status_idx" ON "Coverage"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Coverage_workspaceId_startsAt_idx" ON "Coverage"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "Coverage_requestId_idx" ON "Coverage"("requestId");

-- CreateIndex
CREATE INDEX "CoverageRole_coverageId_idx" ON "CoverageRole"("coverageId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageCall_coverageId_key" ON "CoverageCall"("coverageId");

-- CreateIndex
CREATE INDEX "CoverageCall_status_idx" ON "CoverageCall"("status");

-- CreateIndex
CREATE INDEX "CoverageApplication_callId_status_idx" ON "CoverageApplication"("callId", "status");

-- CreateIndex
CREATE INDEX "CoverageApplication_memberId_idx" ON "CoverageApplication"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageApplication_roleId_memberId_key" ON "CoverageApplication"("roleId", "memberId");

-- CreateIndex
CREATE INDEX "CoverageAssignment_coverageId_status_idx" ON "CoverageAssignment"("coverageId", "status");

-- CreateIndex
CREATE INDEX "CoverageAssignment_memberId_idx" ON "CoverageAssignment"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageAssignment_coverageId_memberId_key" ON "CoverageAssignment"("coverageId", "memberId");

-- CreateIndex
CREATE INDEX "CoverageDeliverable_coverageId_status_idx" ON "CoverageDeliverable"("coverageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageCollaboratorProfile_memberId_key" ON "CoverageCollaboratorProfile"("memberId");

-- CreateIndex
CREATE INDEX "CoverageCollaboratorProfile_workspaceId_active_idx" ON "CoverageCollaboratorProfile"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "CoverageEvent_workspaceId_entityType_entityId_createdAt_idx" ON "CoverageEvent"("workspaceId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "CoverageEvent_workspaceId_createdAt_idx" ON "CoverageEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoverageSettings" ADD CONSTRAINT "CoverageSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequest" ADD CONSTRAINT "CoverageRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequest" ADD CONSTRAINT "CoverageRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageConsent" ADD CONSTRAINT "CoverageConsent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoverageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CoverageRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRole" ADD CONSTRAINT "CoverageRole_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageCall" ADD CONSTRAINT "CoverageCall_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageApplication" ADD CONSTRAINT "CoverageApplication_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CoverageCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageApplication" ADD CONSTRAINT "CoverageApplication_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CoverageRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageApplication" ADD CONSTRAINT "CoverageApplication_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssignment" ADD CONSTRAINT "CoverageAssignment_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssignment" ADD CONSTRAINT "CoverageAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CoverageRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssignment" ADD CONSTRAINT "CoverageAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageDeliverable" ADD CONSTRAINT "CoverageDeliverable_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageDeliverable" ADD CONSTRAINT "CoverageDeliverable_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageCollaboratorProfile" ADD CONSTRAINT "CoverageCollaboratorProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageCollaboratorProfile" ADD CONSTRAINT "CoverageCollaboratorProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageEvent" ADD CONSTRAINT "CoverageEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageEvent" ADD CONSTRAINT "CoverageEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

