-- Etapa 6 FOTOFFICE: informes (Entrega A).
-- Crea una tabla nueva (`FotofficeInformesAjustes`): saldo mínimo de alerta del flujo de caja proyectado y
-- datos del control de monotributo, una fila por workspace. NO suma columnas a ninguna tabla existente.
-- No borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-6-INFORMES.md`).

-- CreateTable
CREATE TABLE "FotofficeInformesAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "minBalanceArs" DECIMAL(14,2),
    "monotributoCategory" TEXT,
    "monotributoCapArs" DECIMAL(14,2),
    "monotributoWarnPct" INTEGER NOT NULL DEFAULT 80,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeInformesAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeInformesAjustes_workspaceId_key" ON "FotofficeInformesAjustes"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECKs (Prisma no los modela)
ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_monotributoWarnPct" CHECK ("monotributoWarnPct" BETWEEN 50 AND 99);
ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_minBalanceArs" CHECK ("minBalanceArs" IS NULL OR "minBalanceArs" >= 0);
ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_monotributoCapArs" CHECK ("monotributoCapArs" IS NULL OR "monotributoCapArs" > 0);
ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_monotributoCategory" CHECK ("monotributoCategory" IS NULL OR length("monotributoCategory") <= 20);
