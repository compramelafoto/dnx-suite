-- Eventos dados de baja: no se muestran en listados pero se conserva el registro (7+ días pasados y 0 fotógrafos inscritos)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Event_archivedAt_idx" ON "Event"("archivedAt");
