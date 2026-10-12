-- DNX Bot etapa 3, fase B: se aplica DESPUÉS de que el deploy con actorKey está en producción. Idempotente.
-- Todo o nada: si algo falla (p. ej. lock_timeout), no queda el trigger borrado con el resto a medias.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- El trigger de la fase A ya no hace falta: el código nuevo siempre manda actorKey.
DROP TRIGGER IF EXISTS "BotUsageDaily_fill_actorKey" ON "BotUsageDaily";
DROP FUNCTION IF EXISTS "BotUsageDaily_fill_actorKey"();
-- Filas creadas por el código anterior durante el deploy (sin actorKey).
UPDATE "BotUsageDaily" SET "actorKey" = 'u:' || "userId" WHERE "actorKey" IS NULL AND "userId" IS NOT NULL;
DELETE FROM "BotUsageDaily" WHERE "actorKey" IS NULL;
ALTER TABLE "BotUsageDaily" ALTER COLUMN "actorKey" SET NOT NULL;
DROP INDEX IF EXISTS "BotUsageDaily_platform_day_userId_key";
COMMIT;
