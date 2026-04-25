-- Jobs de exportación final JPG por proyecto/revisión.

CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DesignProject'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DesignRevision'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
    ) THEN
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
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'designProjectId'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignExportJob_designProjectId_fkey'
        AND t.relname = 'DesignExportJob'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignExportJob"
      ADD CONSTRAINT "DesignExportJob_designProjectId_fkey"
      FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'designRevisionId'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignExportJob_designRevisionId_fkey'
        AND t.relname = 'DesignExportJob'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignExportJob"
      ADD CONSTRAINT "DesignExportJob_designRevisionId_fkey"
      FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'designProjectId'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignExportJob_designProjectId_idx')) IS NULL THEN
      CREATE INDEX "DesignExportJob_designProjectId_idx" ON "DesignExportJob"("designProjectId");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'designRevisionId'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignExportJob_designRevisionId_idx')) IS NULL THEN
      CREATE INDEX "DesignExportJob_designRevisionId_idx" ON "DesignExportJob"("designRevisionId");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'status'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignExportJob_status_idx')) IS NULL THEN
      CREATE INDEX "DesignExportJob_status_idx" ON "DesignExportJob"("status");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignExportJob'
        AND column_name = 'createdAt'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignExportJob_createdAt_idx')) IS NULL THEN
      CREATE INDEX "DesignExportJob_createdAt_idx" ON "DesignExportJob"("createdAt");
    END IF;
  END IF;
END
$$;
