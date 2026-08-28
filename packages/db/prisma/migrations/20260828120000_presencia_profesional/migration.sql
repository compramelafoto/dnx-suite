-- Presencia profesional del socio: redes, sitio web y rubros.
-- Se agrega a la solicitud y al socio: la solicitud captura lo declarado al asociarse,
-- el socio guarda lo vigente (el socio puede actualizarlo después desde su portal).

ALTER TABLE "Member"
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "tiktok" TEXT,
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "youtube" TEXT,
  ADD COLUMN "linkedin" TEXT,
  ADD COLUMN "directoryOptIn" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MembershipApplication"
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "instagram" TEXT,
  ADD COLUMN "tiktok" TEXT,
  ADD COLUMN "facebook" TEXT,
  ADD COLUMN "youtube" TEXT,
  ADD COLUMN "linkedin" TEXT,
  ADD COLUMN "directoryOptIn" BOOLEAN NOT NULL DEFAULT false;
