-- Turnos de servicio: foto opcional de cada tipo en la página pública.
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
