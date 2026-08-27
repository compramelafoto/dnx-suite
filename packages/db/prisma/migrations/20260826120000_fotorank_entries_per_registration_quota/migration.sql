-- FotoRank — cupo de obras por inscripción configurable por concurso.
--
-- Contexto: hasta ahora la base imponía UNA obra por inscripción mediante un
-- índice único sobre "FotorankContestEntry"."registrationId". Eso impedía
-- ofrecer paquetes de varias fotografías.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — el comportamiento de los concursos
-- existentes NO cambia:
--   * No se modifica ninguna fila.
--   * El cupo pasa a definirlo la política del concurso
--     (uploadPolicyJson.maxEntriesPerRegistration), cuyo default es 1.
--   * Los concursos ya creados conservan su política actual, así que siguen
--     admitiendo exactamente una obra por inscripción.
--   * "purchasedEntriesCount" se agrega como NULL: las inscripciones
--     existentes no declaran cupo comprado y siguen gobernadas por la política.
--
-- La garantía que antes daba el índice único ahora la impone la aplicación
-- (ver app/lib/fotorank/entries/entry-quota.ts), que valida el cupo antes de
-- crear cada obra.

-- 1. El límite fijo de una obra por inscripción deja de estar en la base.
DROP INDEX IF EXISTS "FotorankContestEntry_registrationId_key";

-- 2. Se conserva un índice normal: las búsquedas por inscripción siguen siendo
--    tan rápidas como antes.
CREATE INDEX IF NOT EXISTS "FotorankContestEntry_registrationId_idx"
    ON "FotorankContestEntry"("registrationId");

-- 3. Obras habilitadas por el paquete pagado. NULL = no aplica (manda la política).
ALTER TABLE "FotorankContestRegistration"
    ADD COLUMN IF NOT EXISTS "purchasedEntriesCount" INTEGER;
