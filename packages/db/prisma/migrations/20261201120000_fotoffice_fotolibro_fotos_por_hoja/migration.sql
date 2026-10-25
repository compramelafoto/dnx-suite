-- Calculadora de fotolibros: fotos por hoja de cada medida, para sugerir la cantidad de hojas.
-- Idempotente.
ALTER TABLE "FotofficeReglaPrecios" ADD COLUMN IF NOT EXISTS "fotolibroFotosPorHoja" JSONB;
