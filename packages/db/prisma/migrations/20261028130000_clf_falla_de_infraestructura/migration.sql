-- Cuándo este trabajo falló por algo nuestro: credenciales, cupo, red, caída del servicio.
--
-- El cron sólo reclama fotos de los últimos 7 días (`ANALYSIS_MAX_PHOTO_AGE_DAYS`). El
-- tope mide "hace cuánto se subió" como forma de decir "ya nadie la va a buscar", y para
-- una foto vieja cualquiera está bien.
--
-- Pero una foto que no se analizó porque SE NOS CAYÓ LA CREDENCIAL no es vieja: es una
-- que debemos. Con la caída de AWS del 7/10/2026 quedaron 2000 fotos de álbumes con
-- pedidos pagados esperando, y al cumplir 7 días el cron iba a dejar de mirarlas — no por
-- una decisión, sino por un efecto colateral del tope.
--
-- Con esta marca, esas quedan exentas del tope hasta que se analicen. Se borra al
-- lograrlo.
ALTER TABLE "PhotoAnalysisJob" ADD COLUMN IF NOT EXISTS "infraFailureAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_infraFailureAt_idx"
  ON "PhotoAnalysisJob" ("infraFailureAt") WHERE "infraFailureAt" IS NOT NULL;
