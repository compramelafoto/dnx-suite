-- AlterTable
-- Agregar campos lastName y whatsapp a AlbumNotification
ALTER TABLE IF EXISTS "AlbumNotification" ADD COLUMN IF NOT EXISTS "lastName" TEXT,
ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

-- AlterTable
-- Agregar campos lastName y whatsapp a AlbumInterest
ALTER TABLE IF EXISTS "AlbumInterest" ADD COLUMN IF NOT EXISTS "lastName" TEXT,
ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;
