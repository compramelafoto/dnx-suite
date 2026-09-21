-- El portfolio del jurado: hasta 12 imágenes por ficha.
--
-- No toca ninguna tabla existente: sólo agrega. Es la migración más segura
-- posible de este módulo.
--
-- Los archivos viven en el bucket privado de R2. El ON DELETE CASCADE borra las
-- filas cuando se borra el perfil, pero NO borra los objetos del bucket: eso se
-- hace explícitamente desde la aplicación.

CREATE TABLE "FotorankJudgePortfolioImage" (
  "id"             TEXT NOT NULL,
  "judgeProfileId" TEXT NOT NULL,
  "storageKey"     TEXT NOT NULL,
  "contentHash"    TEXT NOT NULL,
  "contentType"    TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL,
  "width"          INTEGER,
  "height"         INTEGER,
  "title"          TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FotorankJudgePortfolioImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankJudgePortfolioImage_judgeProfileId_sortOrder_idx"
  ON "FotorankJudgePortfolioImage"("judgeProfileId", "sortOrder");

ALTER TABLE "FotorankJudgePortfolioImage"
  ADD CONSTRAINT "FotorankJudgePortfolioImage_judgeProfileId_fkey"
  FOREIGN KEY ("judgeProfileId") REFERENCES "FotorankJudgeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
