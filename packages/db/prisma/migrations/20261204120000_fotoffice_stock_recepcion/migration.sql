-- Stock de insumos (etapa 2): recepción de pedidos a proveedor con lector de códigos.
-- Sólo tablas nuevas Fotoffice*: no se toca Product ni StockMovement.
-- Idempotente: se puede correr dos veces sin efecto. Se aplica a mano en la base de FOTOFFICE.

CREATE TABLE IF NOT EXISTS "FotofficeRecepcion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "proveedorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "comprobante" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "preciosConIva" BOOLEAN NOT NULL DEFAULT true,
    "archivoKey" TEXT,
    "nota" TEXT,
    "createdByUserId" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeRecepcion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeRecepcionLinea" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "descripcionOriginal" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "cantidad" INTEGER NOT NULL,
    "enUnidadDeCompra" BOOLEAN NOT NULL DEFAULT false,
    "unidadesPorCompra" INTEGER,
    "costoUnitarioArs" DECIMAL(12,2),
    "origen" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeRecepcionLinea_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeRecepcion_workspaceId_numero_key" ON "FotofficeRecepcion"("workspaceId", "numero");
CREATE INDEX IF NOT EXISTS "FotofficeRecepcion_workspaceId_estado_createdAt_idx" ON "FotofficeRecepcion"("workspaceId", "estado", "createdAt");
CREATE INDEX IF NOT EXISTS "FotofficeRecepcionLinea_recepcionId_order_idx" ON "FotofficeRecepcionLinea"("recepcionId", "order");
CREATE INDEX IF NOT EXISTS "FotofficeRecepcionLinea_workspaceId_productId_idx" ON "FotofficeRecepcionLinea"("workspaceId", "productId");

-- Claves foráneas y CHECK (cada una sólo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcion_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeRecepcion" ADD CONSTRAINT "FotofficeRecepcion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcion_proveedorId_fkey') THEN
    ALTER TABLE "FotofficeRecepcion" ADD CONSTRAINT "FotofficeRecepcion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_recepcionId_fkey') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "FotofficeRecepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_productId_fkey') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcion_estado') THEN
    ALTER TABLE "FotofficeRecepcion" ADD CONSTRAINT "FotofficeRecepcion_estado" CHECK ("estado" IN ('BORRADOR', 'CONFIRMADA', 'DESCARTADA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_origen') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_origen" CHECK ("origen" IN ('LECTOR', 'MANUAL', 'IMPORTACION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_cantidad') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_cantidad" CHECK ("cantidad" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecepcionLinea_unidadesPorCompra') THEN
    ALTER TABLE "FotofficeRecepcionLinea" ADD CONSTRAINT "FotofficeRecepcionLinea_unidadesPorCompra" CHECK ("unidadesPorCompra" IS NULL OR "unidadesPorCompra" >= 1);
  END IF;
END $$;
