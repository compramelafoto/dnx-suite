-- Cursos compartidos entre espacios: el dueño invita a un espacio y puede darlo gratis a sus socios.
ALTER TABLE "CourseResaleAgreement" ADD COLUMN "invitedByOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CourseResaleAgreement" ADD COLUMN "membersFree" BOOLEAN NOT NULL DEFAULT false;
