-- Paridad SCHOOL-PIPELINE-SYNC-LOG: roles en SelectionPhoto + estado DIRTY en preview.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'SelectionPhoto'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'SelectionPhoto'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE "SelectionPhoto" ADD COLUMN "role" TEXT;
  END IF;
END
$$;

DO $$
DECLARE
  design_preview_status_oid oid;
BEGIN
  SELECT t.oid
  INTO design_preview_status_oid
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'DesignPreviewStatus'
    AND n.nspname = current_schema();

  IF design_preview_status_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = design_preview_status_oid
      AND enumlabel = 'DIRTY'
  ) THEN
    ALTER TYPE "DesignPreviewStatus" ADD VALUE 'DIRTY';
  END IF;
END
$$;
