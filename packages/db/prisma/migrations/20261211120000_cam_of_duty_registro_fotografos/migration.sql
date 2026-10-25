-- Cam Of Duty: registro de fotógrafos. Aviso de trabajos cerca (consentimiento) y
-- datos completos en la tabla de miembros, y códigos de 6 dígitos para validar el
-- email. Sólo la usa CompraMeLaFoto. Idempotente.
ALTER TABLE "CamOfDutyMember" ADD COLUMN IF NOT EXISTS "jobAlertsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CamOfDutyMember" ADD COLUMN IF NOT EXISTS "jobAlertsOptInAt" TIMESTAMP(3);
ALTER TABLE "CamOfDutyMember" ADD COLUMN IF NOT EXISTS "jobAlertsOptInIp" TEXT;
ALTER TABLE "CamOfDutyMember" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CamOfDutyMember_jobAlertsOptIn_idx" ON "CamOfDutyMember"("jobAlertsOptIn");

CREATE TABLE IF NOT EXISTS "CamOfDutyEmailCode" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CamOfDutyEmailCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CamOfDutyEmailCode_email_createdAt_idx" ON "CamOfDutyEmailCode"("email", "createdAt");
