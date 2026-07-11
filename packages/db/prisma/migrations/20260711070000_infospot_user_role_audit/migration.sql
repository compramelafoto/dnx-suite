-- Auditoría mínima de asignación de roles Info Spot (CMS DATABASE_URL).
ALTER TABLE "InfoSpotUserRole" ADD COLUMN IF NOT EXISTS "assignedByUserId" INTEGER;
ALTER TABLE "InfoSpotUserRole" ADD COLUMN IF NOT EXISTS "lastChangedByUserId" INTEGER;
