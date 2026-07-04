-- AlterTable
-- Agregar campo googleId al modelo User con restricción unique
ALTER TABLE IF EXISTS "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- Crear índice único para googleId (Prisma maneja @unique como índice único)
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId") WHERE "googleId" IS NOT NULL;
