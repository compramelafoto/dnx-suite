-- FOTOFFICE: comisión de venta del equipo (incentivo por vender fotolibros). Quién cobra
-- comisión, con qué porcentaje y desde cuándo. Lo ganado no se guarda: sale de las ventas y
-- los pedidos cobrados enteros. Sin claves foráneas. Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficeComisionVendedor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeComisionVendedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeComisionVendedor_workspaceId_userId_key" ON "FotofficeComisionVendedor"("workspaceId", "userId");
