-- Pedidos escolares (CLF): avance de impresión de los canjes que son sólo copias impresas, sin librito.
CREATE TABLE IF NOT EXISTS "SchoolCopiesPrintJob" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photographerUserId" INTEGER NOT NULL,
    "printBatchName" TEXT,
    "sentToPrintAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolCopiesPrintJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCopiesPrintJob_orderId_key" ON "SchoolCopiesPrintJob"("orderId");
CREATE INDEX IF NOT EXISTS "SchoolCopiesPrintJob_photographerUserId_printBatchName_idx" ON "SchoolCopiesPrintJob"("photographerUserId", "printBatchName");
