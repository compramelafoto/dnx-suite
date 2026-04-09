-- Jobs de exportación final JPG por proyecto/revisión.

CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "DesignExportJob" (
    "id" TEXT NOT NULL,
    "designProjectId" INTEGER NOT NULL,
    "designRevisionId" INTEGER NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetVersion" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignExportJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DesignExportJob" ADD CONSTRAINT "DesignExportJob_designProjectId_fkey" FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignExportJob" ADD CONSTRAINT "DesignExportJob_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DesignExportJob_designProjectId_idx" ON "DesignExportJob"("designProjectId");
CREATE INDEX "DesignExportJob_designRevisionId_idx" ON "DesignExportJob"("designRevisionId");
CREATE INDEX "DesignExportJob_status_idx" ON "DesignExportJob"("status");
CREATE INDEX "DesignExportJob_createdAt_idx" ON "DesignExportJob"("createdAt");
