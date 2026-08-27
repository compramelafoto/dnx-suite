-- TemplateV2 — vínculo opcional con una institución.
--
-- Contexto: en ComprameLaFoto y Clickatón la plantilla es de una persona y alcanza con
-- ownerUserId. En FotOffice es de la institución: atarla a quien la creó haría que, el día que
-- esa persona deja la comisión directiva, la institución pierda su propio carnet.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Una columna nullable y su índice. Nada más.
--   * Las plantillas existentes quedan en NULL y siguen resolviéndose por ownerUserId,
--     exactamente como hasta ahora.
--   * Sin clave foránea a propósito: la columna es opcional y no debe arrastrar el borrado de
--     un workspace sobre plantillas que pueden ser del catálogo del sistema.

ALTER TABLE "TemplateV2" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
CREATE INDEX IF NOT EXISTS "TemplateV2_workspaceId_idx" ON "TemplateV2"("workspaceId");
