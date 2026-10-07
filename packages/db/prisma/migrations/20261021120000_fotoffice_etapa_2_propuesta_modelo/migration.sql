-- Etapa 2 FOTOFFICE · Entrega B: propuesta modelo por categoría de consulta. Crea UNA tabla nueva,
-- `FotofficePropuestaModelo`, y no toca ninguna tabla existente (las relaciones inversas del esquema
-- de Prisma no son columnas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE,
-- ANTES de publicar el código que la usa.
-- Los ítems (JSON) sólo pueden ser del catálogo del workspace y a precio de lista (modo LISTA): no se
-- puede chequear acá, lo valida el código (`lib/presupuestos/propuestas-modelo.ts`).

-- CreateTable
CREATE TABLE "FotofficePropuestaModelo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "terms" TEXT,
    "autoSendOnWeb" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficePropuestaModelo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePropuestaModelo_workspaceId_categoryId_key" ON "FotofficePropuestaModelo"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "FotofficePropuestaModelo_categoryId_idx" ON "FotofficePropuestaModelo"("categoryId");

-- CreateIndex
CREATE INDEX "FotofficePropuestaModelo_templateId_idx" ON "FotofficePropuestaModelo"("templateId");

-- AddForeignKey
ALTER TABLE "FotofficePropuestaModelo" ADD CONSTRAINT "FotofficePropuestaModelo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePropuestaModelo" ADD CONSTRAINT "FotofficePropuestaModelo_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotofficeConsultaCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePropuestaModelo" ADD CONSTRAINT "FotofficePropuestaModelo_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FotofficeMessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
