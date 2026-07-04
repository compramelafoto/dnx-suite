-- AlterTable
-- Agregar campo fontColor al modelo User
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "fontColor" TEXT;

-- Backfill: default negro para usuarios existentes
UPDATE "User"
SET "fontColor" = '#000000'
WHERE "fontColor" IS NULL;

