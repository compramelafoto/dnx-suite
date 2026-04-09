-- Escuela / plantillas: slots multipágina y roles semánticos para matching PACK.

ALTER TABLE "TemplateSlot" ADD COLUMN IF NOT EXISTS "pageIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TemplateSlot" ADD COLUMN IF NOT EXISTS "role" TEXT;

CREATE INDEX IF NOT EXISTS "TemplateSlot_templateId_pageIndex_idx" ON "TemplateSlot"("templateId", "pageIndex");
