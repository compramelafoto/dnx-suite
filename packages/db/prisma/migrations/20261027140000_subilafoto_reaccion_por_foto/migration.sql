-- De qué foto es cada reacción.
--
-- El contador era del evento entero: un número que subía toda la noche y no decía nada
-- de la foto que estaba en pantalla. Ahora cada reacción queda atada a lo que se estaba
-- proyectando, y el contador se muestra sobre esa foto.
--
-- Nullable: una reacción mandada mientras la pantalla muestra el QR, o un mensaje, o
-- antes de que la pantalla informe qué muestra, no es de ninguna foto. Y `ON DELETE SET
-- NULL` para que borrar una foto no borre la reacción: siguió siendo parte de la noche.
--
-- Aditiva e idempotente.

ALTER TABLE "SubilafotoReaction" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;

CREATE INDEX IF NOT EXISTS "SubilafotoReaction_mediaId_idx"
  ON "SubilafotoReaction" ("mediaId");

DO $$
BEGIN
  ALTER TABLE "SubilafotoReaction"
    ADD CONSTRAINT "SubilafotoReaction_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "SubilafotoMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
