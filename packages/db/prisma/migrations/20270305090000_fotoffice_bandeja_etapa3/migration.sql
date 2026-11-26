-- Bandeja de WhatsApp, etapa 3 (diseño 2026-11-24): chats asignados al dueño del Telegram.
ALTER TABLE "FotofficeTelegramConexion" ADD COLUMN IF NOT EXISTS "bandejaActiva" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "FotofficeWaTelegramAviso" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conexionId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramMessageId" TEXT NOT NULL,
    "textoPendiente" TEXT,
    "pendienteEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeWaTelegramAviso_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeWaTelegramAviso_conexionId_telegramMessageId_key" ON "FotofficeWaTelegramAviso"("conexionId", "telegramMessageId");
CREATE INDEX IF NOT EXISTS "FotofficeWaTelegramAviso_chatId_idx" ON "FotofficeWaTelegramAviso"("chatId");
