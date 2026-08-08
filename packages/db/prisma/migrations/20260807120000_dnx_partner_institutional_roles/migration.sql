-- DNX Partners — roles institucionales + jerarquía visual (aditiva).
-- No DROP TABLE / TRUNCATE / delete de datos.
-- participationType se mantiene por compatibilidad; el rol público es institutionalRole.

CREATE TYPE "DnxPartnerInstitutionalRole" AS ENUM (
  'ORGANIZER',
  'CO_ORGANIZER',
  'INSTITUTIONAL_SPONSOR',
  'MAIN_SPONSOR',
  'SPONSOR',
  'COLLABORATOR',
  'STRATEGIC_PARTNER',
  'MEDIA_PARTNER',
  'SUPPLIER'
);

CREATE TYPE "DnxPartnerDisplayTier" AS ENUM (
  'INSTITUTIONAL',
  'MAIN',
  'STANDARD',
  'SUPPORTING'
);

ALTER TABLE "DnxPartnerParticipation"
  ADD COLUMN "institutionalRole" "DnxPartnerInstitutionalRole",
  ADD COLUMN "displayTier" "DnxPartnerDisplayTier",
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "publicRoleLabel" VARCHAR(120);

-- Backfill desde participationType (sin inferir por monto).
UPDATE "DnxPartnerParticipation"
SET "institutionalRole" = CASE "participationType"::text
  WHEN 'MEDIA_PARTNER' THEN 'MEDIA_PARTNER'::"DnxPartnerInstitutionalRole"
  WHEN 'COLLABORATOR' THEN 'COLLABORATOR'::"DnxPartnerInstitutionalRole"
  WHEN 'INSTITUTIONAL_PARTNER' THEN 'INSTITUTIONAL_SPONSOR'::"DnxPartnerInstitutionalRole"
  WHEN 'SERVICE_PROVIDER' THEN 'SUPPLIER'::"DnxPartnerInstitutionalRole"
  WHEN 'PRIZE_PROVIDER' THEN 'SPONSOR'::"DnxPartnerInstitutionalRole"
  WHEN 'BENEFIT_PROVIDER' THEN 'SPONSOR'::"DnxPartnerInstitutionalRole"
  WHEN 'COMMERCIAL_PARTNER' THEN 'SPONSOR'::"DnxPartnerInstitutionalRole"
  WHEN 'SPONSOR' THEN 'SPONSOR'::"DnxPartnerInstitutionalRole"
  ELSE 'SPONSOR'::"DnxPartnerInstitutionalRole"
END
WHERE "institutionalRole" IS NULL;

UPDATE "DnxPartnerParticipation"
SET "displayTier" = CASE "institutionalRole"::text
  WHEN 'ORGANIZER' THEN 'INSTITUTIONAL'::"DnxPartnerDisplayTier"
  WHEN 'CO_ORGANIZER' THEN 'INSTITUTIONAL'::"DnxPartnerDisplayTier"
  WHEN 'INSTITUTIONAL_SPONSOR' THEN 'INSTITUTIONAL'::"DnxPartnerDisplayTier"
  WHEN 'MAIN_SPONSOR' THEN 'MAIN'::"DnxPartnerDisplayTier"
  WHEN 'SPONSOR' THEN 'STANDARD'::"DnxPartnerDisplayTier"
  ELSE 'SUPPORTING'::"DnxPartnerDisplayTier"
END
WHERE "displayTier" IS NULL;

-- Hint legacy: título "Sponsor principal" → MAIN_SPONSOR / MAIN
UPDATE "DnxPartnerParticipation"
SET
  "institutionalRole" = 'MAIN_SPONSOR'::"DnxPartnerInstitutionalRole",
  "displayTier" = 'MAIN'::"DnxPartnerDisplayTier"
WHERE "institutionalRole" = 'SPONSOR'
  AND lower(coalesce("title", '')) LIKE '%sponsor principal%';

ALTER TABLE "DnxPartnerParticipation"
  ALTER COLUMN "institutionalRole" SET NOT NULL,
  ALTER COLUMN "institutionalRole" SET DEFAULT 'SPONSOR'::"DnxPartnerInstitutionalRole",
  ALTER COLUMN "displayTier" SET NOT NULL,
  ALTER COLUMN "displayTier" SET DEFAULT 'STANDARD'::"DnxPartnerDisplayTier";

CREATE INDEX "DnxPartnerParticipation_context_role_order_idx"
  ON "DnxPartnerParticipation" ("application", "contextType", "contextId", "institutionalRole", "displayOrder");
