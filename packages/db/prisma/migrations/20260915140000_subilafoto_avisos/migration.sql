-- Qué aviso se le mandó a qué evento.
--
-- El criterio 3.7 pide que un reintento del worker no mande el mismo correo dos veces, y
-- eso no se resuelve mirando un registro antes de enviar: entre la consulta y el envío
-- entra otra ejecución. Se resuelve con una restricción de unicidad, que la base cumple
-- aunque dos procesos lleguen juntos.
--
-- La fila se crea ANTES de enviar. Si el envío falla se registra el fallo, pero la fila
-- queda: es preferible perder un aviso a mandarlo dos veces.

CREATE TABLE IF NOT EXISTS "SubilafotoEmailSent" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "aviso"     TEXT NOT NULL,
  "to"        TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'QUEUED',
  "providerId" TEXT,
  "error"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubilafotoEmailSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubilafotoEmailSent_eventId_aviso_key"
  ON "SubilafotoEmailSent"("eventId", "aviso");

CREATE INDEX IF NOT EXISTS "SubilafotoEmailSent_createdAt_idx"
  ON "SubilafotoEmailSent"("createdAt");

ALTER TABLE "SubilafotoEmailSent"
  ADD CONSTRAINT "SubilafotoEmailSent_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
