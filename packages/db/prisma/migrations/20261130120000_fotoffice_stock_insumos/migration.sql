-- Stock de insumos (etapa 1): ficha del insumo, receta por producto y consumo por tamaño de hoja.
-- Sólo tablas nuevas Fotoffice*: no se toca Product ni StockMovement (INSUMO y CONSUMO son texto).
-- Idempotente: se puede correr dos veces sin efecto. Se aplica a mano en la base de FOTOFFICE.

-- Ficha del insumo
CREATE TABLE IF NOT EXISTS "FotofficeInsumo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "unidadCompra" TEXT,
    "unidadesPorCompra" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeInsumo_pkey" PRIMARY KEY ("id")
);

-- Receta: insumos que gasta un producto por cada "porCada" unidades vendidas
CREATE TABLE IF NOT EXISTS "FotofficeRecetaInsumo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "porCada" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeRecetaInsumo_pkey" PRIMARY KEY ("id")
);

-- Consumo de insumo por hoja según salida y tamaño
CREATE TABLE IF NOT EXISTS "FotofficeConsumoTamano" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "salidaId" TEXT NOT NULL,
    "tamanoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeConsumoTamano_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeInsumo_productId_key" ON "FotofficeInsumo"("productId");
CREATE INDEX IF NOT EXISTS "FotofficeInsumo_workspaceId_idx" ON "FotofficeInsumo"("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeRecetaInsumo_productId_insumoId_key" ON "FotofficeRecetaInsumo"("productId", "insumoId");
CREATE INDEX IF NOT EXISTS "FotofficeRecetaInsumo_workspaceId_insumoId_idx" ON "FotofficeRecetaInsumo"("workspaceId", "insumoId");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeConsumoTamano_salidaId_tamanoId_insumoId_key" ON "FotofficeConsumoTamano"("salidaId", "tamanoId", "insumoId");
CREATE INDEX IF NOT EXISTS "FotofficeConsumoTamano_workspaceId_insumoId_idx" ON "FotofficeConsumoTamano"("workspaceId", "insumoId");
CREATE INDEX IF NOT EXISTS "FotofficeConsumoTamano_tamanoId_idx" ON "FotofficeConsumoTamano"("tamanoId");
CREATE INDEX IF NOT EXISTS "FotofficeConsumoTamano_insumoId_idx" ON "FotofficeConsumoTamano"("insumoId");

-- Claves foráneas y CHECK (cada una sólo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeInsumo_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeInsumo" ADD CONSTRAINT "FotofficeInsumo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeInsumo_productId_fkey') THEN
    ALTER TABLE "FotofficeInsumo" ADD CONSTRAINT "FotofficeInsumo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_productId_fkey') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- Restrict: no se borra un insumo que está en alguna receta.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_insumoId_fkey') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeConsumoTamano_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeConsumoTamano" ADD CONSTRAINT "FotofficeConsumoTamano_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeConsumoTamano_salidaId_fkey') THEN
    ALTER TABLE "FotofficeConsumoTamano" ADD CONSTRAINT "FotofficeConsumoTamano_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "FotofficeSalidaImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeConsumoTamano_tamanoId_fkey') THEN
    ALTER TABLE "FotofficeConsumoTamano" ADD CONSTRAINT "FotofficeConsumoTamano_tamanoId_fkey" FOREIGN KEY ("tamanoId") REFERENCES "FotofficeTamanoImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeConsumoTamano_insumoId_fkey') THEN
    ALTER TABLE "FotofficeConsumoTamano" ADD CONSTRAINT "FotofficeConsumoTamano_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_quantity') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_quantity" CHECK ("quantity" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_porCada') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_porCada" CHECK ("porCada" >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecetaInsumo_not_self') THEN
    ALTER TABLE "FotofficeRecetaInsumo" ADD CONSTRAINT "FotofficeRecetaInsumo_not_self" CHECK ("productId" <> "insumoId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeConsumoTamano_quantity') THEN
    ALTER TABLE "FotofficeConsumoTamano" ADD CONSTRAINT "FotofficeConsumoTamano_quantity" CHECK ("quantity" > 0);
  END IF;
END $$;
