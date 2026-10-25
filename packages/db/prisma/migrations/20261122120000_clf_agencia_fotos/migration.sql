-- Modo agencia de CompraMeLaFoto (etapa 2a): ubicación y datos para detectar repetidas en cada foto.
-- Sólo agrega columnas opcionales a "Photo" y dos índices: no toca filas existentes. El schema es compartido:
-- se aplica a mano en las cinco bases ANTES del deploy (si falta la columna, Prisma rompe todas las lecturas
-- de Photo) y se registra con el checksum del archivo.

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoLat" DOUBLE PRECISION;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoLng" DOUBLE PRECISION;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoSource" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "contentSha256" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraSerial" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraImageNumber" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Photo_albumId_contentSha256_idx" ON "Photo"("albumId", "contentSha256");
CREATE INDEX IF NOT EXISTS "Photo_albumId_cameraSerial_cameraImageNumber_idx" ON "Photo"("albumId", "cameraSerial", "cameraImageNumber");
