-- Additive: structured registration answers (ARGRA, etc.). Staging only until approved.
-- Rollback: ALTER TABLE "FotorankContestRegistration" DROP COLUMN IF EXISTS "answersJson";

ALTER TABLE "FotorankContestRegistration" ADD COLUMN IF NOT EXISTS "answersJson" JSONB;
