-- Estados extendidos de DesignProject, revisión humana, preview/export en proyecto.

CREATE TYPE "DesignPreviewStatus" AS ENUM ('IDLE', 'RENDERING', 'READY', 'FAILED');

DO $$
DECLARE
  design_project_status_oid oid;
BEGIN
  SELECT t.oid
  INTO design_project_status_oid
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'DesignProjectStatus'
    AND n.nspname = current_schema();

  IF design_project_status_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'DRAFT_RENDERING'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'DRAFT_RENDERING';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'PENDING_PHOTOGRAPHER_APPROVAL'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'PENDING_PHOTOGRAPHER_APPROVAL';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'APPROVED_FOR_EXPORT'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'APPROVED_FOR_EXPORT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'NEEDS_ADJUSTMENT'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'NEEDS_ADJUSTMENT';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'EXPORTING'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'EXPORTING';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum WHERE enumtypid = design_project_status_oid AND enumlabel = 'EXPORTED'
    ) THEN
      ALTER TYPE "DesignProjectStatus" ADD VALUE 'EXPORTED';
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'DesignProject'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'approvedForExportRevisionId'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "approvedForExportRevisionId" INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'approvedAt'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "approvedAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'approvedByUserId'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "approvedByUserId" INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'rejectedAt'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "rejectedAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'rejectedByUserId'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "rejectedByUserId" INTEGER;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'reviewReason'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "reviewReason" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'reviewNote'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "reviewNote" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewUrl'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewUrl" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewDirty'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewDirty" BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewStatus'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewStatus" "DesignPreviewStatus" NOT NULL DEFAULT 'IDLE';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewGeneratedAt'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewGeneratedAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewVersion'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewVersion" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'previewError'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "previewError" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'exportUrlJpg'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "exportUrlJpg" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'exportUrlPdf'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "exportUrlPdf" TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'exportGeneratedAt'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "exportGeneratedAt" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'exportVersion'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "exportVersion" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DesignProject'
        AND column_name = 'exportError'
    ) THEN
      ALTER TABLE "DesignProject" ADD COLUMN "exportError" TEXT;
    END IF;

    IF to_regclass(format('%I.%I', current_schema(), 'DesignProject_approvedForExportRevisionId_key')) IS NULL THEN
      CREATE UNIQUE INDEX "DesignProject_approvedForExportRevisionId_key" ON "DesignProject"("approvedForExportRevisionId");
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'DesignRevision'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignProject_approvedForExportRevisionId_fkey'
        AND t.relname = 'DesignProject'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignProject"
      ADD CONSTRAINT "DesignProject_approvedForExportRevisionId_fkey"
      FOREIGN KEY ("approvedForExportRevisionId") REFERENCES "DesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'User'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignProject_approvedByUserId_fkey'
        AND t.relname = 'DesignProject'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignProject"
      ADD CONSTRAINT "DesignProject_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'User'
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE c.conname = 'DesignProject_rejectedByUserId_fkey'
        AND t.relname = 'DesignProject'
        AND n.nspname = current_schema()
    ) THEN
      ALTER TABLE "DesignProject"
      ADD CONSTRAINT "DesignProject_rejectedByUserId_fkey"
      FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF to_regclass(format('%I.%I', current_schema(), 'DesignProject_approvedByUserId_idx')) IS NULL THEN
      CREATE INDEX "DesignProject_approvedByUserId_idx" ON "DesignProject"("approvedByUserId");
    END IF;

    IF to_regclass(format('%I.%I', current_schema(), 'DesignProject_rejectedByUserId_idx')) IS NULL THEN
      CREATE INDEX "DesignProject_rejectedByUserId_idx" ON "DesignProject"("rejectedByUserId");
    END IF;
  END IF;
END
$$;
