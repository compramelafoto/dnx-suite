-- Alta de jurados de FotoRank por cuenta propia, con revisión previa de DNX.
--
-- La verificación del correo NO agrega tablas: usa EmailVerificationToken con
-- purpose = 'VERIFY_EMAIL', que ya existe en las cinco bases.
--
-- Las filas que ya existan quedan APPROVED y ORGANIZER_CREATED. Si quedaran
-- PENDING desaparecerían del directorio sin que nadie entienda por qué.

CREATE TYPE "FotorankJudgeDirectoryReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FotorankJudgeSignupSource" AS ENUM ('ORGANIZER_CREATED', 'ORGANIZER_INVITATION', 'PUBLIC_SIGNUP');

ALTER TABLE "FotorankJudgeAccount"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "FotorankJudgeProfile"
  ADD COLUMN "signupSource" "FotorankJudgeSignupSource" NOT NULL DEFAULT 'ORGANIZER_CREATED',
  ADD COLUMN "directoryReviewStatus" "FotorankJudgeDirectoryReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "directoryReviewedAt" TIMESTAMP(3),
  ADD COLUMN "directoryReviewedByUserId" INTEGER,
  ADD COLUMN "directoryReviewNotes" TEXT,
  ADD COLUMN "wantsDirectoryListing" BOOLEAN NOT NULL DEFAULT false;

-- Los perfiles que ya existían los cargó un organizador, que respondió por ellos.
UPDATE "FotorankJudgeProfile"
   SET "directoryReviewStatus" = 'APPROVED',
       "wantsDirectoryListing" = "isListedInProfessionalDirectory";

CREATE INDEX "FotorankJudgeProfile_directoryReviewStatus_idx"
  ON "FotorankJudgeProfile"("directoryReviewStatus");

-- Un alta pública no pertenece a ninguna organización, y los hechos de
-- plataforma (alta, aprobación, rechazo) igual tienen que quedar auditados.
ALTER TABLE "FotorankJudgeAuditEvent" ALTER COLUMN "organizationId" DROP NOT NULL;
