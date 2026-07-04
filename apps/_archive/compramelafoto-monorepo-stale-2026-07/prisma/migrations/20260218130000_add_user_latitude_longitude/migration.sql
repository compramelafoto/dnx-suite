-- Ubicación del usuario (fotógrafo) para eventos cerca e invitaciones por proximidad
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
