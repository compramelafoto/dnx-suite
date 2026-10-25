-- FOTOFFICE: qué productos dan comisión de venta al equipo. Sin filas, rigen los de fotolibro
-- (por código). Sin claves foráneas. Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficeComisionProducto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeComisionProducto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeComisionProducto_workspaceId_productId_key" ON "FotofficeComisionProducto"("workspaceId", "productId");
