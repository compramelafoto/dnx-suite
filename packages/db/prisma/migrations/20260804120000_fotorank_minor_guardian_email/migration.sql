-- Additive: guardian contact email for minor authorizations (ages 16–17).
-- Production release candidate — non-destructive.
-- Rollback: ALTER TABLE "FotorankMinorAuthorization" DROP COLUMN IF EXISTS "guardianEmail";

ALTER TABLE "FotorankMinorAuthorization" ADD COLUMN IF NOT EXISTS "guardianEmail" TEXT;
