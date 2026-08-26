-- Content reports / intellectual property complaint flow (additive, non-destructive)
-- Do NOT apply to production without staging validation and backup authorization.

CREATE TYPE "ContentReportStatus" AS ENUM (
  'RECEIVED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'CONTENT_TEMPORARILY_HIDDEN',
  'REJECTED',
  'RESTORED',
  'REMOVED',
  'CLOSED'
);

CREATE TYPE "ContentReportContentType" AS ENUM (
  'PHOTO',
  'ALBUM',
  'OTHER_URL'
);

CREATE TYPE "ContentReportPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TYPE "ContentReportActingAs" AS ENUM (
  'COPYRIGHT_OWNER',
  'AUTHORIZED_AGENT',
  'OTHER_INTERESTED_PARTY'
);

CREATE TABLE "ContentReport" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "status" "ContentReportStatus" NOT NULL DEFAULT 'RECEIVED',
  "priority" "ContentReportPriority" NOT NULL DEFAULT 'NORMAL',
  "contentType" "ContentReportContentType" NOT NULL,
  "contentUrl" TEXT NOT NULL,
  "photoId" INTEGER,
  "albumId" INTEGER,
  "reportedUserId" INTEGER,
  "reporterName" TEXT NOT NULL,
  "reporterEmail" TEXT NOT NULL,
  "actingAs" "ContentReportActingAs" NOT NULL,
  "originalWorkDescription" TEXT NOT NULL,
  "claimDescription" TEXT NOT NULL,
  "evidenceLinks" TEXT,
  "goodFaithDeclaration" BOOLEAN NOT NULL DEFAULT false,
  "truthfulnessDeclaration" BOOLEAN NOT NULL DEFAULT false,
  "dataProcessingAccepted" BOOLEAN NOT NULL DEFAULT false,
  "resolution" TEXT,
  "internalNotes" TEXT,
  "assignedAdminId" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "reporterIpMinimized" TEXT,
  "reporterUserAgent" TEXT,
  "metadata" JSONB,

  CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentReportEvent" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" INTEGER,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" "ContentReportStatus",
  "toStatus" "ContentReportStatus",
  "reason" TEXT,
  "metadata" JSONB,

  CONSTRAINT "ContentReportEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");
CREATE INDEX "ContentReport_contentType_idx" ON "ContentReport"("contentType");
CREATE INDEX "ContentReport_priority_idx" ON "ContentReport"("priority");
CREATE INDEX "ContentReport_createdAt_idx" ON "ContentReport"("createdAt");
CREATE INDEX "ContentReport_reportedUserId_idx" ON "ContentReport"("reportedUserId");
CREATE INDEX "ContentReport_assignedAdminId_idx" ON "ContentReport"("assignedAdminId");
CREATE INDEX "ContentReport_photoId_idx" ON "ContentReport"("photoId");
CREATE INDEX "ContentReport_albumId_idx" ON "ContentReport"("albumId");
CREATE INDEX "ContentReport_reporterEmail_idx" ON "ContentReport"("reporterEmail");

CREATE INDEX "ContentReportEvent_reportId_idx" ON "ContentReportEvent"("reportId");
CREATE INDEX "ContentReportEvent_createdAt_idx" ON "ContentReportEvent"("createdAt");
CREATE INDEX "ContentReportEvent_action_idx" ON "ContentReportEvent"("action");

ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentReportEvent" ADD CONSTRAINT "ContentReportEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ContentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReportEvent" ADD CONSTRAINT "ContentReportEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
