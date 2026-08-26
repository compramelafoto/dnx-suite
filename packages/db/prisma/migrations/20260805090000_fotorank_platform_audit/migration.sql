-- CreateTable
CREATE TABLE "FotorankPlatformAuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "organizationId" TEXT,
    "contestId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankPlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotorankPlatformAuditEvent_actorUserId_createdAt_idx" ON "FotorankPlatformAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FotorankPlatformAuditEvent_organizationId_createdAt_idx" ON "FotorankPlatformAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FotorankPlatformAuditEvent_contestId_createdAt_idx" ON "FotorankPlatformAuditEvent"("contestId", "createdAt");

-- CreateIndex
CREATE INDEX "FotorankPlatformAuditEvent_action_createdAt_idx" ON "FotorankPlatformAuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "FotorankPlatformAuditEvent" ADD CONSTRAINT "FotorankPlatformAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
