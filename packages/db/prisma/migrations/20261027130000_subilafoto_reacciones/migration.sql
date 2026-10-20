-- Reacciones en vivo a la pantalla del salón: el invitado manda un emoji y aparece
-- proyectado, con un contador de lo que mandó todo el salón.
--
-- Una fila por reacción y no un contador: el total se saca sumando, y tener el detalle
-- permite frenar al que aprieta sin parar y reconstruir la noche después.
--
-- Aditiva e idempotente: tabla nueva, no toca nada existente.

CREATE TABLE IF NOT EXISTS "SubilafotoReaction" (
  "id"             TEXT NOT NULL,
  "eventId"        TEXT NOT NULL,
  "guestSessionId" TEXT,
  "emoji"          TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubilafotoReaction_pkey" PRIMARY KEY ("id")
);

-- La pantalla pregunta una vez por segundo qué llegó después de tal momento.
CREATE INDEX IF NOT EXISTS "SubilafotoReaction_eventId_createdAt_idx"
  ON "SubilafotoReaction" ("eventId", "createdAt");

-- El freno al que aprieta sin parar: cuántas mandó y cuándo fue la última.
CREATE INDEX IF NOT EXISTS "SubilafotoReaction_guestSessionId_createdAt_idx"
  ON "SubilafotoReaction" ("guestSessionId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "SubilafotoReaction"
    ADD CONSTRAINT "SubilafotoReaction_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "SubilafotoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SubilafotoReaction"
    ADD CONSTRAINT "SubilafotoReaction_guestSessionId_fkey"
    FOREIGN KEY ("guestSessionId") REFERENCES "SubilafotoGuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
