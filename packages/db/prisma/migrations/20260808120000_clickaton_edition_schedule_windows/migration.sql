-- ETAPA 12: ventanas temporales a nivel edición (reveal global + captura + carga).
-- Additive. Prompt fields quedan como denormalización/cache.

ALTER TABLE "ClickatonEditionUploadConfig"
  ADD COLUMN IF NOT EXISTS "eventRevealAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "captureWindowStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "captureWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "uploadWindowStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "uploadWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "globalPromptReveal" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowReplacement" BOOLEAN NOT NULL DEFAULT true;

-- Marker de inscripción de Modo Test (nunca comercial).
ALTER TABLE "ClickatonRegistration"
  ADD COLUMN IF NOT EXISTS "isOpsTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "ClickatonRegistration_editionId_isOpsTest_idx"
  ON "ClickatonRegistration"("editionId", "isOpsTest");
