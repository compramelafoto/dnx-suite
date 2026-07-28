-- Clickatón Etapa 1: campos comerciales de edición (additive only).
-- No DROP / TRUNCATE / DELETE. No activar ventas públicas.

ALTER TABLE "ClickatonEdition" ADD COLUMN "registrationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClickatonEdition" ADD COLUMN "location" TEXT;
ALTER TABLE "ClickatonEdition" ADD COLUMN "city" TEXT;
ALTER TABLE "ClickatonEdition" ADD COLUMN "provinceOrState" TEXT;
ALTER TABLE "ClickatonEdition" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'AR';
ALTER TABLE "ClickatonEdition" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "ClickatonEdition" ADD COLUMN "paymentBeneficiaryConfig" JSONB;

CREATE INDEX "ClickatonEdition_registrationEnabled_idx" ON "ClickatonEdition"("registrationEnabled");
