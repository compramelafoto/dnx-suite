-- ¿Cuánto Cobro? en el portal del socio: el perfil de precios personal. Crea UNA tabla nueva,
-- `FotofficePerfilPreciosSocio` (una fila por persona), y no toca ninguna tabla existente.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en la base de FOTOFFICE
-- ANTES de publicar el código que la usa, y después `prisma migrate resolve --applied`.

-- CreateTable
CREATE TABLE "FotofficePerfilPreciosSocio" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "profileData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePerfilPreciosSocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePerfilPreciosSocio_userId_key" ON "FotofficePerfilPreciosSocio"("userId");

-- AddForeignKey
ALTER TABLE "FotofficePerfilPreciosSocio" ADD CONSTRAINT "FotofficePerfilPreciosSocio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
