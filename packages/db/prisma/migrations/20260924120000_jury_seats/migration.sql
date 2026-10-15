-- Vacantes de jurado.
--
-- Separar "cuantos jurados van a ser" de "quienes son" es lo que deja que el
-- jurado ya confirmado empiece a calificar sin esperar al que todavia falta:
-- el reparto de obras se calcula sobre vacantes numeradas, no sobre personas.

-- Cuantas vacantes abre esta sesion de puntuacion.
-- Nulo = todavia no se declaro: no hay reparto y cada jurado ve todo.
ALTER TABLE "FotorankJuryScoringSession"
  ADD COLUMN IF NOT EXISTS "plannedSeats" INTEGER;

-- Que vacante ocupa esta persona. Nulo = asignacion sin reparto, como hasta ahora.
ALTER TABLE "FotorankJudgeAssignment"
  ADD COLUMN IF NOT EXISTS "seatNumber" INTEGER;

-- Excepciones al reparto. El reparto se calcula y no se guarda; esto es lo unico
-- que se escribe, y solo cuando alguien redistribuye a mano el lote de una
-- vacante que nunca se lleno.
CREATE TABLE IF NOT EXISTS "FotorankJurySeatPromptOverride" (
  "id" TEXT NOT NULL,
  "scoringSessionId" TEXT NOT NULL,
  "seatNumber" INTEGER NOT NULL,
  "promptExternalId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotorankJurySeatPromptOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankJurySeatPromptOverride_unico"
  ON "FotorankJurySeatPromptOverride" ("scoringSessionId", "seatNumber", "promptExternalId");

CREATE INDEX IF NOT EXISTS "FotorankJurySeatPromptOverride_sesion"
  ON "FotorankJurySeatPromptOverride" ("scoringSessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FotorankJurySeatPromptOverride_scoringSessionId_fkey'
  ) THEN
    ALTER TABLE "FotorankJurySeatPromptOverride"
      ADD CONSTRAINT "FotorankJurySeatPromptOverride_scoringSessionId_fkey"
      FOREIGN KEY ("scoringSessionId") REFERENCES "FotorankJuryScoringSession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
