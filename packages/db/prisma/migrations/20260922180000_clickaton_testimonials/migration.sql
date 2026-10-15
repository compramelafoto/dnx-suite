-- Testimonios y relación de calidad de Clickatón.
-- Se aplica a mano en la base de Clickatón antes de publicar el código:
-- el deploy no corre `prisma migrate deploy`, y sin las columnas nuevas de
-- "ClickatonEdition" falla TODA lectura de ediciones, no sólo lo nuevo.

DO $$ BEGIN
  CREATE TYPE "ClickatonTestimonialAuthorRole" AS ENUM ('PARTICIPANT', 'JUROR', 'VENUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClickatonTestimonialStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClickatonSurveyWouldReturn" AS ENUM ('YES', 'MAYBE', 'NO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClickatonTestimonialInviteStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RESPONDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Interruptores del módulo en la edición. Nace apagado.
ALTER TABLE "ClickatonEdition"
  ADD COLUMN IF NOT EXISTS "testimonialsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "testimonialInviteDelayDays" INTEGER NOT NULL DEFAULT 2;

-- La encuesta: privada, nunca se sirve al público.
CREATE TABLE IF NOT EXISTS "ClickatonSurveyResponse" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "authorRole" "ClickatonTestimonialAuthorRole" NOT NULL,
  "registrationId" TEXT,
  "venueId" TEXT,
  "npsScore" INTEGER NOT NULL,
  "scoreOrganization" INTEGER,
  "scorePrompts" INTEGER,
  "scoreVenue" INTEGER,
  "scoreKit" INTEGER,
  "scoreAccreditation" INTEGER,
  "scoreCommunication" INTEGER,
  "scoreValueForMoney" INTEGER,
  "wouldReturn" "ClickatonSurveyWouldReturn",
  "improvementNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "auditIp" TEXT,
  "auditUserAgent" TEXT,
  CONSTRAINT "ClickatonSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonSurveyResponse_editionId_userId_key"
  ON "ClickatonSurveyResponse"("editionId", "userId");
CREATE INDEX IF NOT EXISTS "ClickatonSurveyResponse_editionId_authorRole_idx"
  ON "ClickatonSurveyResponse"("editionId", "authorRole");
CREATE INDEX IF NOT EXISTS "ClickatonSurveyResponse_editionId_npsScore_idx"
  ON "ClickatonSurveyResponse"("editionId", "npsScore");

-- El testimonio: lo único que puede llegar al sitio público.
CREATE TABLE IF NOT EXISTS "ClickatonTestimonial" (
  "id" TEXT NOT NULL,
  "surveyResponseId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "authorRole" "ClickatonTestimonialAuthorRole" NOT NULL,
  "quote" TEXT NOT NULL,
  "highlightedExcerpt" TEXT,
  "status" "ClickatonTestimonialStatus" NOT NULL DEFAULT 'PENDING',
  "publicationConsent" BOOLEAN NOT NULL DEFAULT false,
  "consentAcceptedAt" TIMESTAMP(3),
  "authorName" TEXT NOT NULL,
  "authorPhotoAssetId" TEXT,
  "authorLinkUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "moderatedByUserId" INTEGER,
  "moderationNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonTestimonial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonTestimonial_surveyResponseId_key"
  ON "ClickatonTestimonial"("surveyResponseId");
CREATE INDEX IF NOT EXISTS "ClickatonTestimonial_editionId_status_idx"
  ON "ClickatonTestimonial"("editionId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonTestimonial_status_displayOrder_idx"
  ON "ClickatonTestimonial"("status", "displayOrder");

-- A quién se invitó. La clave única por edición y correo evita el doble envío.
CREATE TABLE IF NOT EXISTS "ClickatonTestimonialInvite" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "authorRole" "ClickatonTestimonialAuthorRole" NOT NULL,
  "email" TEXT NOT NULL,
  "userId" INTEGER,
  "registrationId" TEXT,
  "venueId" TEXT,
  "status" "ClickatonTestimonialInviteStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "emailQueueId" INTEGER,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonTestimonialInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonTestimonialInvite_idempotencyKey_key"
  ON "ClickatonTestimonialInvite"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonTestimonialInvite_editionId_email_key"
  ON "ClickatonTestimonialInvite"("editionId", "email");
CREATE INDEX IF NOT EXISTS "ClickatonTestimonialInvite_editionId_status_idx"
  ON "ClickatonTestimonialInvite"("editionId", "status");

DO $$ BEGIN
  ALTER TABLE "ClickatonSurveyResponse"
    ADD CONSTRAINT "ClickatonSurveyResponse_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonTestimonial"
    ADD CONSTRAINT "ClickatonTestimonial_surveyResponseId_fkey"
    FOREIGN KEY ("surveyResponseId") REFERENCES "ClickatonSurveyResponse"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonTestimonial"
    ADD CONSTRAINT "ClickatonTestimonial_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonTestimonialInvite"
    ADD CONSTRAINT "ClickatonTestimonialInvite_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
