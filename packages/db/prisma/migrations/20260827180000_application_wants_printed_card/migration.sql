-- FotOffice — el formulario de asociación pregunta si además quiere la credencial impresa.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Agrega una sola columna booleana con default en false.
--   * Las solicitudes existentes quedan en false, que es el comportamiento actual: hasta hoy
--     nadie pudo pedirla al asociarse.

ALTER TABLE "MembershipApplication"
  ADD COLUMN IF NOT EXISTS "wantsPrintedCard" BOOLEAN NOT NULL DEFAULT false;
