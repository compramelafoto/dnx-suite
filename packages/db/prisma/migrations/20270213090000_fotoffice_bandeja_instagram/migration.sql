-- FOTOFFICE: mensajes directos de Instagram en la Bandeja (canal por chat, conexión de Instagram y aprobación).
-- Sólo agrega columnas y cambia el único del chat; no toca datos. Los chats existentes quedan en WHATSAPP.

-- AlterTable
ALTER TABLE "FotofficeWaChat" ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "FotofficeWaChat" ADD COLUMN "usuarioInstagram" TEXT;

-- DropIndex
DROP INDEX "FotofficeWaChat_workspaceId_waId_key";

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaChat_workspaceId_canal_waId_key" ON "FotofficeWaChat"("workspaceId", "canal", "waId");

-- AlterTable
ALTER TABLE "FotofficeWaConexion" ADD COLUMN "igAccountId" TEXT;
ALTER TABLE "FotofficeWaConexion" ADD COLUMN "igPageId" TEXT;
ALTER TABLE "FotofficeWaConexion" ADD COLUMN "igUsuario" TEXT;
ALTER TABLE "FotofficeWaConexion" ADD COLUMN "igActivo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaConexion_igAccountId_key" ON "FotofficeWaConexion"("igAccountId");

-- AlterTable
ALTER TABLE "FotofficePresupuestoAprobacion" ADD COLUMN "igChatId" TEXT;
