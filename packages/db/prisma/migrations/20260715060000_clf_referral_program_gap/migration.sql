-- Gap staging CLF: columnas/programa de referidos presentes en schema Prisma
-- pero ausentes en DB Preview. Solo additive; no toca producción.

DO $$ BEGIN
  CREATE TYPE "ReferralProgram" AS ENUM ('PHOTOGRAPHER_REFERRAL', 'ORGANIZER_REFERRAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ReferralAttribution"
  ADD COLUMN IF NOT EXISTS "referralProgram" "ReferralProgram" NOT NULL DEFAULT 'PHOTOGRAPHER_REFERRAL';

ALTER TABLE "ReferralAttribution"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "ReferralAttribution"
  ADD COLUMN IF NOT EXISTS "sourceEntityId" INTEGER;

ALTER TABLE "ReferralEarning"
  ADD COLUMN IF NOT EXISTS "referralProgram" "ReferralProgram" NOT NULL DEFAULT 'PHOTOGRAPHER_REFERRAL';

CREATE INDEX IF NOT EXISTS "ReferralAttribution_sourceType_sourceEntityId_idx"
  ON "ReferralAttribution"("sourceType", "sourceEntityId");

CREATE INDEX IF NOT EXISTS "ReferralAttribution_referralProgram_idx"
  ON "ReferralAttribution"("referralProgram");

CREATE INDEX IF NOT EXISTS "ReferralEarning_referralProgram_idx"
  ON "ReferralEarning"("referralProgram");
