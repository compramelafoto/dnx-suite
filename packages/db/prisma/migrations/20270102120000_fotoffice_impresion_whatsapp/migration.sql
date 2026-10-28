-- Pedidos de impresión por el bot de WhatsApp (spec 2026-10-28): seña, pagos, papel y plazo por ítem,
-- fotos sin recorte.
ALTER TABLE "FotofficePrintOrder" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "depositArs" DECIMAL(12,2);
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "paidArs" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "pagosExtra" JSONB;
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "waChatId" TEXT;
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "waId" TEXT;
CREATE INDEX IF NOT EXISTS "FotofficePrintOrder_workspaceId_waChatId_status_idx" ON "FotofficePrintOrder"("workspaceId", "waChatId", "status");
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "paper" TEXT;
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "plazo" TEXT;
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "sinRecorte" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "calidadBaja" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotofficePrintSettings" ADD COLUMN IF NOT EXISTS "depositPct" INTEGER NOT NULL DEFAULT 50;
