-- FOTOFFICE: el QR fijo de Mercado Pago del mostrador (sucursal y caja creadas en la cuenta del negocio). Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficeQrMostrador" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalStoreId" TEXT NOT NULL,
    "posId" TEXT NOT NULL,
    "externalPosId" TEXT NOT NULL,
    "qrImage" TEXT,
    "qrPdf" TEXT,
    "ordenPendienteId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeQrMostrador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeQrMostrador_workspaceId_key" ON "FotofficeQrMostrador"("workspaceId");
