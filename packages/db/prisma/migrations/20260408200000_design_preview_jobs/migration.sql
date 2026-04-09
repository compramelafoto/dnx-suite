-- Jobs de preview asíncrona por revisión.

CREATE TYPE "DesignPreviewJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "DesignPreviewJob" (
    "id" TEXT NOT NULL,
    "designRevisionId" INTEGER NOT NULL,
    "status" "DesignPreviewJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetVersion" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignPreviewJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DesignPreviewJob" ADD CONSTRAINT "DesignPreviewJob_designRevisionId_fkey" FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DesignPreviewJob_designRevisionId_idx" ON "DesignPreviewJob"("designRevisionId");
CREATE INDEX "DesignPreviewJob_status_idx" ON "DesignPreviewJob"("status");
CREATE INDEX "DesignPreviewJob_createdAt_idx" ON "DesignPreviewJob"("createdAt");
