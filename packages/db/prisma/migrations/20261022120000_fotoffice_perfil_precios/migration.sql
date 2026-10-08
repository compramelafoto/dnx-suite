-- Perfil de precios del workspace (Configuración → Precios). Crea UNA tabla nueva,
-- `FotofficePerfilPrecios`, y no toca ninguna tabla existente.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en la base de FOTOFFICE
-- ANTES de publicar el código que la usa, y después `prisma migrate resolve --applied`.

-- CreateTable
CREATE TABLE "FotofficePerfilPrecios" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "profileData" JSONB NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficePerfilPrecios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePerfilPrecios_workspaceId_key" ON "FotofficePerfilPrecios"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficePerfilPrecios" ADD CONSTRAINT "FotofficePerfilPrecios_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
