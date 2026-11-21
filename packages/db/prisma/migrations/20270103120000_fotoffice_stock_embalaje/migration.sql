-- Stock: embalaje por entrega (etapa 1). Envoltorios del negocio y forma de entrega de cada producto.
-- Sólo tablas nuevas Fotoffice*: no se toca Product ni StockMovement.
-- Idempotente: se puede correr dos veces sin efecto. Se aplica a mano en la base de FOTOFFICE.

CREATE TABLE IF NOT EXISTS "FotofficeEmbalaje" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "admiteAnchoCm" DECIMAL(6,1) NOT NULL,
    "admiteAltoCm" DECIMAL(6,1) NOT NULL,
    "piezasPorUnidad" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEmbalaje_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeProductoEntrega" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "forma" TEXT NOT NULL,
    "anchoCm" DECIMAL(6,1),
    "altoCm" DECIMAL(6,1),
    "embalajeSiguiente" BOOLEAN NOT NULL DEFAULT false,
    "embalajeFijoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProductoEntrega_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeEmbalaje_insumoId_key" ON "FotofficeEmbalaje"("insumoId");
CREATE INDEX IF NOT EXISTS "FotofficeEmbalaje_workspaceId_idx" ON "FotofficeEmbalaje"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeProductoEntrega_productId_key" ON "FotofficeProductoEntrega"("productId");
CREATE INDEX IF NOT EXISTS "FotofficeProductoEntrega_workspaceId_idx" ON "FotofficeProductoEntrega"("workspaceId");
CREATE INDEX IF NOT EXISTS "FotofficeProductoEntrega_embalajeFijoId_idx" ON "FotofficeProductoEntrega"("embalajeFijoId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEmbalaje_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeEmbalaje" ADD CONSTRAINT "FotofficeEmbalaje_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- Restrict: no se borra un insumo que es un envoltorio (igual que en las recetas).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEmbalaje_insumoId_fkey') THEN
    ALTER TABLE "FotofficeEmbalaje" ADD CONSTRAINT "FotofficeEmbalaje_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeProductoEntrega_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeProductoEntrega" ADD CONSTRAINT "FotofficeProductoEntrega_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeProductoEntrega_productId_fkey') THEN
    ALTER TABLE "FotofficeProductoEntrega" ADD CONSTRAINT "FotofficeProductoEntrega_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeProductoEntrega_embalajeFijoId_fkey') THEN
    ALTER TABLE "FotofficeProductoEntrega" ADD CONSTRAINT "FotofficeProductoEntrega_embalajeFijoId_fkey" FOREIGN KEY ("embalajeFijoId") REFERENCES "FotofficeEmbalaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEmbalaje_tipo') THEN
    ALTER TABLE "FotofficeEmbalaje" ADD CONSTRAINT "FotofficeEmbalaje_tipo" CHECK ("tipo" IN ('SOBRE', 'BOLSA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEmbalaje_medidas') THEN
    ALTER TABLE "FotofficeEmbalaje" ADD CONSTRAINT "FotofficeEmbalaje_medidas" CHECK ("admiteAnchoCm" > 0 AND "admiteAltoCm" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeEmbalaje_piezasPorUnidad') THEN
    ALTER TABLE "FotofficeEmbalaje" ADD CONSTRAINT "FotofficeEmbalaje_piezasPorUnidad" CHECK ("piezasPorUnidad" IS NULL OR "piezasPorUnidad" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeProductoEntrega_forma') THEN
    ALTER TABLE "FotofficeProductoEntrega" ADD CONSTRAINT "FotofficeProductoEntrega_forma" CHECK ("forma" IN ('PIEZA_SUELTA', 'ENMARCADO', 'VOLUMEN', 'SIN_EMBALAJE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeProductoEntrega_medidas') THEN
    ALTER TABLE "FotofficeProductoEntrega" ADD CONSTRAINT "FotofficeProductoEntrega_medidas" CHECK (("anchoCm" IS NULL OR "anchoCm" > 0) AND ("altoCm" IS NULL OR "altoCm" > 0));
  END IF;
END $$;
