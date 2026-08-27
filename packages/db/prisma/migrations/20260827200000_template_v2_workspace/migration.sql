-- TemplateV2 — vínculo opcional con una institución.
--
-- Contexto: en ComprameLaFoto y Clickatón la plantilla es de una persona y alcanza con
-- ownerUserId. En FotOffice es de la institución: atarla a quien la creó haría que, el día que
-- esa persona deja la comisión directiva, la institución pierda su propio carnet.
--
-- CONDICIONAL A PROPÓSITO. Las tablas TemplateV2* no existen en todas las bases: una migración
-- de julio las salteó explícitamente. En una base que ya las tiene, esto agrega la columna; en
-- una que no, no hace nada y la columna llega con la migración que crea las tablas, que ya la
-- incluye. Así la misma serie de migraciones sirve para los dos casos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'TemplateV2'
  ) THEN
    ALTER TABLE "TemplateV2" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
    CREATE INDEX IF NOT EXISTS "TemplateV2_workspaceId_idx" ON "TemplateV2"("workspaceId");
  END IF;
END
$$;
