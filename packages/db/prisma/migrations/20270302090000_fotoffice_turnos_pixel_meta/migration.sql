-- Turnos de servicio: píxel de Meta adicional por tipo de turno (sólo en la página de ese turno).
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "metaPixelId" TEXT;
