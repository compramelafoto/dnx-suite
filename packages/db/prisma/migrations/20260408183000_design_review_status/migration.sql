-- Estados extendidos de DesignProject, revisión humana, preview/export en proyecto.

CREATE TYPE "DesignPreviewStatus" AS ENUM ('IDLE', 'RENDERING', 'READY', 'FAILED');

ALTER TYPE "DesignProjectStatus" ADD VALUE 'DRAFT_RENDERING';
ALTER TYPE "DesignProjectStatus" ADD VALUE 'PENDING_PHOTOGRAPHER_APPROVAL';
ALTER TYPE "DesignProjectStatus" ADD VALUE 'APPROVED_FOR_EXPORT';
ALTER TYPE "DesignProjectStatus" ADD VALUE 'NEEDS_ADJUSTMENT';
ALTER TYPE "DesignProjectStatus" ADD VALUE 'EXPORTING';
ALTER TYPE "DesignProjectStatus" ADD VALUE 'EXPORTED';

ALTER TABLE "DesignProject" ADD COLUMN "approvedForExportRevisionId" INTEGER;
ALTER TABLE "DesignProject" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN "approvedByUserId" INTEGER;
ALTER TABLE "DesignProject" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN "rejectedByUserId" INTEGER;
ALTER TABLE "DesignProject" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "previewUrl" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "previewDirty" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DesignProject" ADD COLUMN "previewStatus" "DesignPreviewStatus" NOT NULL DEFAULT 'IDLE';
ALTER TABLE "DesignProject" ADD COLUMN "previewGeneratedAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN "previewVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DesignProject" ADD COLUMN "previewError" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "exportUrlJpg" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "exportUrlPdf" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN "exportGeneratedAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN "exportVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DesignProject" ADD COLUMN "exportError" TEXT;

CREATE UNIQUE INDEX "DesignProject_approvedForExportRevisionId_key" ON "DesignProject"("approvedForExportRevisionId");

ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_approvedForExportRevisionId_fkey" FOREIGN KEY ("approvedForExportRevisionId") REFERENCES "DesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesignProject" ADD CONSTRAINT "DesignProject_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DesignProject_approvedByUserId_idx" ON "DesignProject"("approvedByUserId");
CREATE INDEX "DesignProject_rejectedByUserId_idx" ON "DesignProject"("rejectedByUserId");
