-- Bandeja + Telegram: el aviso queda atado también al chat de Telegram (los números de mensaje se
-- repiten si se vincula otro celular) y guarda el mensaje pendiente de «Tomarlo y enviar».
ALTER TABLE "FotofficeWaTelegramAviso" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FotofficeWaTelegramAviso" ALTER COLUMN "telegramChatId" DROP DEFAULT;
ALTER TABLE "FotofficeWaTelegramAviso" ADD COLUMN IF NOT EXISTS "telegramPendienteId" TEXT;
DROP INDEX IF EXISTS "FotofficeWaTelegramAviso_conexionId_telegramMessageId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeWaTelegramAviso_conexionId_telegramChatId_telegramMessageId_key" ON "FotofficeWaTelegramAviso"("conexionId", "telegramChatId", "telegramMessageId");
