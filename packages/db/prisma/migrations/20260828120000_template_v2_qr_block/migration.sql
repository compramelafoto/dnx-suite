-- Módulo de diseño — bloque de código QR.
--
-- El editor tenía previsto el tipo de variable `qrUrl` pero ningún bloque que lo dibujara. Sin
-- eso no se puede diseñar el dorso de una credencial, que es justamente un QR de verificación.
-- Lo van a usar también las entradas y los diplomas.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Agrega un valor al enum. Ninguna fila existente cambia, y las plantillas ya guardadas
--     siguen validando igual.

ALTER TYPE "TemplateV2BlockType" ADD VALUE IF NOT EXISTS 'QR';
