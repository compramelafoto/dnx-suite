-- FotoRank: configuración visual editable de la página pública por concurso.
-- Aditiva, nullable y reversible (DROP COLUMN).

ALTER TABLE "FotorankContest"
ADD COLUMN IF NOT EXISTS "publicPageVisualJson" JSONB;
