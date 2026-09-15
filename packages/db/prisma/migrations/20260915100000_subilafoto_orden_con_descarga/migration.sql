-- La orden registra si la descarga iba incluida.
--
-- El fotógrafo vende de dos formas: su precio a secas, o su precio más un 10% con la
-- descarga incluida. La orden tiene que guardar cuál de las dos fue, porque de eso depende
-- que al pagar se entregue el paquete o no.
--
-- Deducirlo de los montos sería frágil: el mismo total puede salir de dos configuraciones
-- distintas, y una cuenta que se hace hacia atrás se rompe el día que cambia un porcentaje.

ALTER TABLE "SubilafotoOrder" ADD COLUMN IF NOT EXISTS "includesDownload" BOOLEAN NOT NULL DEFAULT false;
