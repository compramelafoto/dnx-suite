-- Bandeja de WhatsApp, etapa 1 (diseño 2026-11-24): quién resolvió cada chat.
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "resueltoPorUserId" INTEGER;
