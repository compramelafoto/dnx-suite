-- Jobs de preview asíncrona por revisión.

CREATE TYPE "DesignPreviewJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DesignRevision'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'DesignPreviewJob'
    ) THEN
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
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignPreviewJob'
        AND column_name = 'designRevisionId'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignPreviewJob_designRevisionId_fkey'
        AND t.relname = 'DesignPreviewJob'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignPreviewJob"
      ADD CONSTRAINT "DesignPreviewJob_designRevisionId_fkey"
      FOREIGN KEY ("designRevisionId") REFERENCES "DesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignPreviewJob'
        AND column_name = 'designRevisionId'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignPreviewJob_designRevisionId_idx')) IS NULL THEN
      CREATE INDEX "DesignPreviewJob_designRevisionId_idx" ON "DesignPreviewJob"("designRevisionId");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignPreviewJob'
        AND column_name = 'status'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignPreviewJob_status_idx')) IS NULL THEN
      CREATE INDEX "DesignPreviewJob_status_idx" ON "DesignPreviewJob"("status");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignPreviewJob'
        AND column_name = 'createdAt'
    ) AND to_regclass(format('%I.%I', current_schema(), 'DesignPreviewJob_createdAt_idx')) IS NULL THEN
      CREATE INDEX "DesignPreviewJob_createdAt_idx" ON "DesignPreviewJob"("createdAt");
    END IF;
  END IF;
END
$$;
