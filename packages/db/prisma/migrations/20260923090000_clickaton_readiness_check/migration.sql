-- Centro de Transmisión, etapa 1: prueba técnica previa.
-- Aditiva: tabla nueva, ninguna tabla existente cambia.

CREATE TABLE IF NOT EXISTS "ClickatonReadinessCheck" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hasGps" BOOLEAN NOT NULL,
  "clockDeltaMinutes" INTEGER,
  "imageWidth" INTEGER,
  "imageHeight" INTEGER,
  "result" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonReadinessCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonReadinessCheck_editionId_result_idx"
  ON "ClickatonReadinessCheck" ("editionId", "result");

CREATE INDEX IF NOT EXISTS "ClickatonReadinessCheck_registrationId_checkedAt_idx"
  ON "ClickatonReadinessCheck" ("registrationId", "checkedAt");

DO $$
BEGIN
  ALTER TABLE "ClickatonReadinessCheck"
    ADD CONSTRAINT "ClickatonReadinessCheck_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ClickatonReadinessCheck"
    ADD CONSTRAINT "ClickatonReadinessCheck_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
