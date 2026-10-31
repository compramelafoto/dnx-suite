-- Referidos de DNX Suite: altas en otras plataformas (FOTOFFICE, FotoRank, Muestras…) que
-- llegaron con un código de referido de CLF. Sólo la base de CLF (rama production).
-- Se aplica a mano y se registra con
-- `prisma migrate resolve --applied 20270115120000_clf_suite_referral_signup`.
CREATE TABLE IF NOT EXISTS "SuiteReferralSignup" (
  "id" SERIAL NOT NULL,
  "platform" TEXT NOT NULL,
  "externalUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "refCode" TEXT NOT NULL,
  "referralCodeId" INTEGER,
  "referrerUserId" INTEGER,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuiteReferralSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SuiteReferralSignup_platform_externalUserId_key"
  ON "SuiteReferralSignup"("platform", "externalUserId");
CREATE INDEX IF NOT EXISTS "SuiteReferralSignup_referrerUserId_idx" ON "SuiteReferralSignup"("referrerUserId");
CREATE INDEX IF NOT EXISTS "SuiteReferralSignup_refCode_idx" ON "SuiteReferralSignup"("refCode");
CREATE INDEX IF NOT EXISTS "SuiteReferralSignup_createdAt_idx" ON "SuiteReferralSignup"("createdAt");
