-- Los saludos grabados del invitado.
--
-- Un audio es como un mensaje pero con la voz: se graba desde el teléfono, no hace
-- falta escribir, y para alguien que no se lleva bien con el teclado es la diferencia
-- entre dejar un saludo y no dejar nada.
--
-- Aditiva: un valor nuevo en el enum. Va con `IF NOT EXISTS` porque ALTER TYPE no se
-- puede deshacer y correrlo dos veces romperia la migracion.

ALTER TYPE "SubilafotoMediaKind" ADD VALUE IF NOT EXISTS 'AUDIO';
