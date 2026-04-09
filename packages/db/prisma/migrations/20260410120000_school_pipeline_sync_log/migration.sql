-- Paridad SCHOOL-PIPELINE-SYNC-LOG: roles en SelectionPhoto + estado DIRTY en preview.

ALTER TABLE "SelectionPhoto" ADD COLUMN IF NOT EXISTS "role" TEXT;

ALTER TYPE "DesignPreviewStatus" ADD VALUE 'DIRTY';
