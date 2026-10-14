-- Producción del librito: lote de impresión, enviado a imprimir, impreso y entregado.
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "printBatchName" TEXT;
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "sentToPrintAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "printedAt" TIMESTAMP(3);
ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "DesignProject_photographerUserId_printBatchName_idx" ON "DesignProject"("photographerUserId", "printBatchName");
