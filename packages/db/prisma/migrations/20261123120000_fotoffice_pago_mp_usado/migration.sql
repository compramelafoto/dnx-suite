-- FOTOFFICE: cobros de Mercado Pago ya usados por "Verificar pago" del Mostrador. Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficePagoMpUsado" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mpPaymentId" TEXT NOT NULL,
    "montoArs" DECIMAL(12,2) NOT NULL,
    "pagador" TEXT,
    "usadoEn" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficePagoMpUsado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePagoMpUsado_workspaceId_mpPaymentId_key" ON "FotofficePagoMpUsado"("workspaceId", "mpPaymentId");
