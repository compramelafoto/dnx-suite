-- Un evento puede tener más de una orden.
--
-- El modelo original ataba una orden a un evento con un índice único, pensando sólo en la
-- venta del evento. Pero el adicional de descarga es **otra orden sobre el mismo evento**:
-- se cobra aparte, a otra cuenta y con otro reparto. Con el único puesto, comprar la
-- descarga fallaba al guardar.
--
-- Quitar un índice único sólo permite más filas: no borra nada ni invalida lo existente.

DROP INDEX IF EXISTS "SubilafotoOrder_eventId_key";
CREATE INDEX IF NOT EXISTS "SubilafotoOrder_eventId_idx" ON "SubilafotoOrder"("eventId");
