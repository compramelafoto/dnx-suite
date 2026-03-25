-- AlterTable
ALTER TABLE "Template" ADD COLUMN "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Template" ADD COLUMN "theme" TEXT;
ALTER TABLE "Template" ADD COLUMN "pagesJson" JSONB;
