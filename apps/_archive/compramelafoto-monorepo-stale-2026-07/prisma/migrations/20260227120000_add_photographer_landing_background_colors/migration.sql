-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "headerBackgroundColor" TEXT,
ADD COLUMN IF NOT EXISTS "footerBackgroundColor" TEXT,
ADD COLUMN IF NOT EXISTS "heroBackgroundColor" TEXT,
ADD COLUMN IF NOT EXISTS "pageBackgroundColor" TEXT;
