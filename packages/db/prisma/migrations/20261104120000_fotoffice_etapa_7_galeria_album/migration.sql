-- Etapa 7 FOTOFFICE, Entrega C: galería de aprobación de ÁLBUM (láminas por rondas, comentarios marcados en un punto,
-- aprobar o pedir cambios).
-- Cambia el CHECK de `FotofficeGaleria.kind` (de 'SELECCION'|'ENTREGA' a 'SELECCION'|'ENTREGA'|'ALBUM', con el mismo
-- nombre de restricción), crea `FotofficeGaleriaRonda` y `FotofficeGaleriaDecision`, y suma columnas nulas a
-- `FotofficeGaleriaFoto` (`rondaId`) y `FotofficeGaleriaComentario` (`rondaId`, `pinX`, `pinY`, `pinNumber`).
-- No borra ni actualiza filas: las galerías y comentarios existentes quedan con `rondaId` y pin en NULL.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-C.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/galerias`): el tope de 300 láminas por ronda, el de 300
-- comentarios por cliente y ronda, que sólo las galerías de ÁLBUM tengan rondas y que las fotos de un álbum estén en
-- su ronda abierta.

-- CreateTable
CREATE TABLE "FotofficeGaleriaRonda" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABIERTA',
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FotofficeGaleriaRonda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaDecision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaClienteId" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeGaleriaDecision_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FotofficeGaleriaFoto" ADD COLUMN "rondaId" TEXT;

-- AlterTable
ALTER TABLE "FotofficeGaleriaComentario" ADD COLUMN "rondaId" TEXT,
ADD COLUMN "pinX" DOUBLE PRECISION,
ADD COLUMN "pinY" DOUBLE PRECISION,
ADD COLUMN "pinNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaRonda_galeriaId_number_key" ON "FotofficeGaleriaRonda"("galeriaId", "number");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaRonda_workspaceId_idx" ON "FotofficeGaleriaRonda"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaDecision_galeriaClienteId_rondaId_key" ON "FotofficeGaleriaDecision"("galeriaClienteId", "rondaId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDecision_rondaId_idx" ON "FotofficeGaleriaDecision"("rondaId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDecision_workspaceId_idx" ON "FotofficeGaleriaDecision"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaFoto_rondaId_order_idx" ON "FotofficeGaleriaFoto"("rondaId", "order");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaComentario_rondaId_idx" ON "FotofficeGaleriaComentario"("rondaId");

-- A lo sumo una ronda abierta por galería (índice único parcial; Prisma no lo modela).
CREATE UNIQUE INDEX "FotofficeGaleriaRonda_galeriaId_abierta_key" ON "FotofficeGaleriaRonda"("galeriaId") WHERE "status" = 'ABIERTA';

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDecision" ADD CONSTRAINT "FotofficeGaleriaDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDecision" ADD CONSTRAINT "FotofficeGaleriaDecision_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDecision" ADD CONSTRAINT "FotofficeGaleriaDecision_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "FotofficeGaleriaRonda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "FotofficeGaleriaRonda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "FotofficeGaleriaRonda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeGaleria" DROP CONSTRAINT "FotofficeGaleria_kind";
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA', 'ALBUM'));
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_number" CHECK ("number" >= 1);
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_status" CHECK ("status" IN ('ABIERTA', 'CERRADA'));
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_note" CHECK ("note" IS NULL OR char_length("note") <= 2000);
ALTER TABLE "FotofficeGaleriaRonda" ADD CONSTRAINT "FotofficeGaleriaRonda_closedAt" CHECK (("status" = 'ABIERTA' AND "closedAt" IS NULL) OR ("status" = 'CERRADA' AND "closedAt" IS NOT NULL));
ALTER TABLE "FotofficeGaleriaDecision" ADD CONSTRAINT "FotofficeGaleriaDecision_decision" CHECK ("decision" IN ('APROBADO', 'CAMBIOS'));
ALTER TABLE "FotofficeGaleriaDecision" ADD CONSTRAINT "FotofficeGaleriaDecision_message" CHECK ("message" IS NULL OR char_length("message") <= 2000);
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_pin" CHECK (
  ("pinX" IS NULL AND "pinY" IS NULL AND "pinNumber" IS NULL)
  OR ("pinX" IS NOT NULL AND "pinY" IS NOT NULL AND "pinX" >= 0 AND "pinX" <= 1 AND "pinY" >= 0 AND "pinY" <= 1 AND "pinNumber" IS NOT NULL AND "pinNumber" >= 1)
);
