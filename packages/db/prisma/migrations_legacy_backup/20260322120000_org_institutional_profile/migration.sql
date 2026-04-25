-- AlterTable: perfil institucional de organización + campos landing concurso
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "ContestOrganization" ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "FotorankContest" ADD COLUMN IF NOT EXISTS "prizesSummary" TEXT;
ALTER TABLE "FotorankContest" ADD COLUMN IF NOT EXISTS "sponsorsText" TEXT;
