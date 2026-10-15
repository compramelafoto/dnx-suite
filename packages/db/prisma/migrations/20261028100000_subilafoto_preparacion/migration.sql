-- Lo que el fotógrafo confirmó sobre el salón, con la fecha de cada confirmación.
--
-- `{ "pantalla": "2026-10-11T12:00:00.000Z", "impresos": "..." }`. Guarda la fecha y no
-- un sí: una confirmación sobre el salón hecha hace tres semanas vale menos que una de
-- ayer, y con la fecha a la vista se puede decidir si hay que volver a preguntar.
--
-- Nace de la fiesta del 10/10/2026, que no se hizo porque el salón no tenía pantalla.
ALTER TABLE "SubilafotoEvent" ADD COLUMN IF NOT EXISTS "preparacion" JSONB;
