-- Cantidad máxima de fotos permitidas para descarga por álbum (organizador)
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "maxDownloadAllowed" INTEGER;
