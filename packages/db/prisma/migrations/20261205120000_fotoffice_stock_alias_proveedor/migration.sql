-- Stock de insumos (etapa 3): alias de proveedor para asociar solas las líneas importadas.
-- Sólo tabla nueva Fotoffice*. Idempotente. Se aplica a mano en la base de FOTOFFICE.

CREATE TABLE IF NOT EXISTS "FotofficeAliasProveedor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "textoNormalizado" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAliasProveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeAliasProveedor_proveedorId_textoNormalizado_key" ON "FotofficeAliasProveedor"("proveedorId", "textoNormalizado");
CREATE INDEX IF NOT EXISTS "FotofficeAliasProveedor_workspaceId_proveedorId_idx" ON "FotofficeAliasProveedor"("workspaceId", "proveedorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeAliasProveedor_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeAliasProveedor" ADD CONSTRAINT "FotofficeAliasProveedor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeAliasProveedor_proveedorId_fkey') THEN
    ALTER TABLE "FotofficeAliasProveedor" ADD CONSTRAINT "FotofficeAliasProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeAliasProveedor_productId_fkey') THEN
    ALTER TABLE "FotofficeAliasProveedor" ADD CONSTRAINT "FotofficeAliasProveedor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
