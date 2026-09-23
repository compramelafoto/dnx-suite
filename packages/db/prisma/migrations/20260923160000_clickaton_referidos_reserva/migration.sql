-- Referidos de Clickatón — Etapa 02 (canje del beneficio).
--
-- Estado RESERVED: colegas tomados por una inscripción que todavía no se pagó.
-- Sin él, dos inscripciones simultáneas usarían los mismos colegas y las dos
-- entrarían con descuento.
--
-- ALTER TYPE ... ADD VALUE no puede correr en la misma transacción que crea el
-- tipo; acá el tipo ya existe, así que es seguro.
ALTER TYPE "ClickatonReferralAttributionStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
