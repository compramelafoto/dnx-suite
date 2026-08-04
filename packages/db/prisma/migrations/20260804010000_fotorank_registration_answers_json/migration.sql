-- Additive: structured registration answers (ARGRA, Instagram handle, operational communications, etc.).
-- Intended for production release candidate (additive, non-destructive).
-- Rollback: ALTER TABLE "FotorankContestRegistration" DROP COLUMN IF EXISTS "answersJson";

ALTER TABLE "FotorankContestRegistration" ADD COLUMN IF NOT EXISTS "answersJson" JSONB;
