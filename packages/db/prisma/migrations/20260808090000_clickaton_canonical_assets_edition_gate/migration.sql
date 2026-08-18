-- ETAPA 11D: gating canónico de assets por edición + marker ops fixture.
-- Defaults false: edición comercial intacta.

ALTER TABLE "ClickatonEdition"
ADD COLUMN IF NOT EXISTS "isOpsFixture" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClickatonEditionUploadConfig"
ADD COLUMN IF NOT EXISTS "canonicalAssetsEnabled" BOOLEAN NOT NULL DEFAULT false;
