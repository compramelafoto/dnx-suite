-- Carpetas armadas para todo el curso: el diseño recuerda de qué alumno del padrón es.
-- Aditiva e idempotente.

ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "rosterEntryId" INTEGER;
CREATE INDEX IF NOT EXISTS "DesignProject_rosterEntryId_idx" ON "DesignProject"("rosterEntryId");
