-- Listas de precios de proveedores: proveedor preferido, costo y margen por producto, reglas de
-- redondeo por workspace, listas subidas y equivalencias recordadas.
-- Idempotente: se puede correr dos veces sin efecto.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "preferredProveedorId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "marginPct" DECIMAL(7,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Product_preferredProveedorId_idx" ON "Product"("preferredProveedorId");

CREATE TABLE IF NOT EXISTS "FotofficeReglaPrecios" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "redondeo" JSONB NOT NULL,
    "fotolibroMarginPct" DECIMAL(7,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeReglaPrecios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeReglaPrecios_workspaceId_key" ON "FotofficeReglaPrecios"("workspaceId");

CREATE TABLE IF NOT EXISTS "FotofficeListaProveedor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "vigencia" TEXT NOT NULL,
    "nombreArchivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "creadaPorUserId" INTEGER,
    "aplicadaPorUserId" INTEGER,
    "aplicadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeListaProveedor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotofficeListaProveedor_workspaceId_proveedorId_createdAt_idx" ON "FotofficeListaProveedor"("workspaceId", "proveedorId", "createdAt");

CREATE TABLE IF NOT EXISTS "FotofficeListaProveedorItem" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "fila" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "modelo" TEXT,
    "medida" TEXT,
    "variante" TEXT,
    "cantidadMinima" INTEGER,
    "unidad" TEXT NOT NULL,
    "costoArs" DECIMAL(12,2) NOT NULL,
    "codigoProveedor" TEXT,
    "notas" TEXT,
    "clave" TEXT NOT NULL,
    "productId" TEXT,
    "factor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    CONSTRAINT "FotofficeListaProveedorItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotofficeListaProveedorItem_listaId_fila_idx" ON "FotofficeListaProveedorItem"("listaId", "fila");
CREATE INDEX IF NOT EXISTS "FotofficeListaProveedorItem_productId_idx" ON "FotofficeListaProveedorItem"("productId");

CREATE TABLE IF NOT EXISTS "FotofficeEquivalenciaProveedor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "factor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeEquivalenciaProveedor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FotofficeEquivalenciaProveedor_productId_idx" ON "FotofficeEquivalenciaProveedor"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquivalenciaProveedor_workspaceId_proveedorId_clav_key" ON "FotofficeEquivalenciaProveedor"("workspaceId", "proveedorId", "clave");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEquivalenciaProveedor_workspaceId_proveedorId_prod_key" ON "FotofficeEquivalenciaProveedor"("workspaceId", "proveedorId", "productId");

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredProveedorId_fkey" FOREIGN KEY ("preferredProveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeReglaPrecios" ADD CONSTRAINT "FotofficeReglaPrecios_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeListaProveedor" ADD CONSTRAINT "FotofficeListaProveedor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeListaProveedor" ADD CONSTRAINT "FotofficeListaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeListaProveedorItem" ADD CONSTRAINT "FotofficeListaProveedorItem_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "FotofficeListaProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeListaProveedorItem" ADD CONSTRAINT "FotofficeListaProveedorItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeEquivalenciaProveedor" ADD CONSTRAINT "FotofficeEquivalenciaProveedor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeEquivalenciaProveedor" ADD CONSTRAINT "FotofficeEquivalenciaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeEquivalenciaProveedor" ADD CONSTRAINT "FotofficeEquivalenciaProveedor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
