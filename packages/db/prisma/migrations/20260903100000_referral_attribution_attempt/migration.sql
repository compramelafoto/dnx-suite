-- Registro de altas que llegaron con código de referido pero no generaron atribución.
-- Antes estos casos se descartaban en silencio y no se podían auditar ni recuperar.
CREATE TABLE IF NOT EXISTS "ReferralAttributionAttempt" (
    "id" SERIAL NOT NULL,
    "refCode" TEXT NOT NULL,
    "referredUserId" INTEGER,
    "referredEmail" TEXT,
    "referrerUserId" INTEGER,
    "outcome" TEXT NOT NULL,
    "detail" TEXT,
    "logContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralAttributionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralAttributionAttempt_refCode_idx"
    ON "ReferralAttributionAttempt"("refCode");
CREATE INDEX IF NOT EXISTS "ReferralAttributionAttempt_outcome_createdAt_idx"
    ON "ReferralAttributionAttempt"("outcome", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralAttributionAttempt_referredUserId_idx"
    ON "ReferralAttributionAttempt"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralAttributionAttempt_createdAt_idx"
    ON "ReferralAttributionAttempt"("createdAt");
