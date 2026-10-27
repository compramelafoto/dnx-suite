-- Releer sólo el texto de fotos ya analizadas, sin volver a indexar caras.
ALTER TABLE "PhotoAnalysisJob" ADD COLUMN IF NOT EXISTS "soloTexto" BOOLEAN NOT NULL DEFAULT false;
