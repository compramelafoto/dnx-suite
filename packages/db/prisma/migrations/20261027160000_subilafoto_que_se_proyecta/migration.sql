-- Qué foto está proyectándose ahora mismo.
--
-- La pantalla del salón es la única que sabe qué se está viendo: la rotación la decide
-- ella, con su propio reloj, no el servidor. Sin este dato una reacción no se puede
-- atribuir a ninguna foto, y el contador tiene que ser del evento entero.
--
-- Aditiva e idempotente.

ALTER TABLE "SubilafotoEvent" ADD COLUMN IF NOT EXISTS "nowShowingMediaId" TEXT;
ALTER TABLE "SubilafotoEvent" ADD COLUMN IF NOT EXISTS "nowShowingAt" TIMESTAMP(3);
