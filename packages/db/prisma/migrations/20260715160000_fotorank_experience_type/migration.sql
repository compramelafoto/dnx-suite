-- Etapa 09A: tipo de experiencia pública (aditivo).
-- Default CONTEST = backfill seguro: ninguna fila existente pasa a MARATHON ni a Clickatón.

CREATE TYPE "FotorankExperienceType" AS ENUM ('CONTEST', 'MARATHON');

ALTER TABLE "FotorankContest"
ADD COLUMN "experienceType" "FotorankExperienceType" NOT NULL DEFAULT 'CONTEST';

CREATE INDEX "FotorankContest_visibility_status_experienceType_distributionChannel_idx"
ON "FotorankContest"("visibility", "status", "experienceType", "distributionChannel");
