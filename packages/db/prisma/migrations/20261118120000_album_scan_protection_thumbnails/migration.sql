-- Protección "ventana de escaneo" también en las miniaturas de la galería.
-- Interruptor aparte del de la foto ampliada. Apagado por defecto.
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "scanProtectionThumbnailsEnabled" BOOLEAN NOT NULL DEFAULT false;
