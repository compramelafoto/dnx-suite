-- packages/db/prisma/migrations/20260922090000_clickaton_consentimientos_ubicacion/migration.sql
-- Centro de Transmisión, etapa 0: consentimientos de ubicación.
-- Aditivo y reversible: sin default en las fechas, null = no consintió.

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "locationConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationPublicConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interviewConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "locationConsentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "locationConsentDeclaredAdult" BOOLEAN NOT NULL DEFAULT false;

-- El panel del operador filtra por quién aceptó aparecer en el mapa.
CREATE INDEX IF NOT EXISTS "ClickatonRegistration_locationPublicConsentAt_idx"
  ON "ClickatonRegistration" ("locationPublicConsentAt");
