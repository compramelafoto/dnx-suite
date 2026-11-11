-- Contactos DNX: nuevo tipo de evento BUSQUEDA_CORREO (paso «completar correos» del Buscador: cada
-- intento de conseguirle el correo a un contacto que ya estaba sin email, con su resultado y su costo).
-- Rehace el CHECK de tipo de DnxContactoEvento. Idempotente: se puede correr dos veces.
ALTER TABLE "DnxContactoEvento" DROP CONSTRAINT IF EXISTS "DnxContactoEvento_tipo_check";
ALTER TABLE "DnxContactoEvento" ADD CONSTRAINT "DnxContactoEvento_tipo_check" CHECK ("tipo" IN
  ('CREADO', 'DATO_NUEVO', 'ESTADO', 'NOTA', 'FUSIONADO', 'VINCULADO', 'CORREO_ENVIADO', 'CORREO_RECIBIDO',
   'BUSQUEDA_CORREO'));

-- El gasto del mes suma estos eventos por tipo y fecha.
CREATE INDEX IF NOT EXISTS "DnxContactoEvento_tipo_creadoEn_idx" ON "DnxContactoEvento"("tipo", "creadoEn");
