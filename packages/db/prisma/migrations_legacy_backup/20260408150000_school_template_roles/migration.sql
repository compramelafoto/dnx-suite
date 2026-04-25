-- Escuela / plantillas: slots multipágina y roles semánticos para matching PACK.
-- Si la tabla no existe en la historia, esta migración queda en no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'TemplateSlot'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'TemplateSlot'
        AND column_name = 'pageIndex'
    ) THEN
      ALTER TABLE "TemplateSlot" ADD COLUMN "pageIndex" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'TemplateSlot'
        AND column_name = 'role'
    ) THEN
      ALTER TABLE "TemplateSlot" ADD COLUMN "role" TEXT;
    END IF;

    IF to_regclass(format('%I.%I', current_schema(), 'TemplateSlot_templateId_pageIndex_idx')) IS NULL THEN
      CREATE INDEX "TemplateSlot_templateId_pageIndex_idx" ON "TemplateSlot"("templateId", "pageIndex");
    END IF;
  END IF;
END
$$;
