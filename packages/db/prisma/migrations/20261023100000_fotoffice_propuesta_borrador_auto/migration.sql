-- FOTOFFICE · Borrador automático: interruptor por categoría de consulta. Crea UNA tabla nueva,
-- `FotofficePropuestaBorradorAuto` (la fila existe = encendido), y no toca ninguna tabla existente
-- (las relaciones inversas del esquema de Prisma no son columnas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.
-- El código tolera que la tabla falte (queda apagado), así que puede publicarse antes o después.

-- CreateTable
CREATE TABLE "FotofficePropuestaBorradorAuto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER,

    CONSTRAINT "FotofficePropuestaBorradorAuto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePropuestaBorradorAuto_workspaceId_categoryId_key" ON "FotofficePropuestaBorradorAuto"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "FotofficePropuestaBorradorAuto_categoryId_idx" ON "FotofficePropuestaBorradorAuto"("categoryId");

-- AddForeignKey
ALTER TABLE "FotofficePropuestaBorradorAuto" ADD CONSTRAINT "FotofficePropuestaBorradorAuto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePropuestaBorradorAuto" ADD CONSTRAINT "FotofficePropuestaBorradorAuto_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotofficeConsultaCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
