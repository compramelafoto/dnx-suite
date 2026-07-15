-- Etapa 08C: discriminador de canal de publicación pública (aditivo).
-- NULL = publicación general FotoRank (no visible en Clickatón).

CREATE TYPE "FotorankDistributionChannel" AS ENUM ('FOTORANK', 'CLICKATON');

ALTER TABLE "FotorankContest"
ADD COLUMN "distributionChannel" "FotorankDistributionChannel";

CREATE INDEX "FotorankContest_visibility_status_distributionChannel_idx"
ON "FotorankContest"("visibility", "status", "distributionChannel");
