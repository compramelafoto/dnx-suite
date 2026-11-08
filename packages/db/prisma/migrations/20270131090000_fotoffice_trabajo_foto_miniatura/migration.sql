-- Miniatura de cada foto de Trabajos: el sitio la usa en mosaicos y tarjetas en vez de la original.
-- Sólo existe en la base de FOTOFFICE (rama development de divine-hall): las demás no tienen la tabla.
ALTER TABLE "FotofficeTrabajoFoto" ADD COLUMN IF NOT EXISTS "miniaturaUrl" TEXT;
