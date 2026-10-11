-- Etapa 7 FOTOFFICE, Entrega A2: venta de fotos extra de la galería.
-- Suma columnas a `FotofficeGaleria` y `FotofficeGaleriaAjustes` (tablas de la Entrega A1, sin datos de otras
-- etapas) y crea dos tablas nuevas: `FotofficeGaleriaCompra` y `FotofficeGaleriaCompraFoto`.
-- No borra nada ni actualiza filas: las columnas nuevas nacen con valores por omisión que dejan las galerías
-- existentes en `SELECCION` sin precios.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A2.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/galerias/precios`): la forma de `discountRules`
-- (hasta 4 reglas, `pct` 1 a 90, `desde` >= 2, sin repetir y ordenadas) y que el rubro sea de ingreso y del workspace.

-- AlterTable
ALTER TABLE "FotofficeGaleria" ADD COLUMN "includedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pricingMode" TEXT,
ADD COLUMN "unitPriceArs" DECIMAL(14,2),
ADD COLUMN "packageSize" INTEGER,
ADD COLUMN "packagePriceArs" DECIMAL(14,2),
ADD COLUMN "discountMode" TEXT NOT NULL DEFAULT 'NINGUNO',
ADD COLUMN "discountPct" INTEGER,
ADD COLUMN "discountRules" JSONB,
ADD COLUMN "incomeCategoryId" TEXT;

-- AlterTable
ALTER TABLE "FotofficeGaleriaAjustes" ADD COLUMN "defaultIncomeCategoryId" TEXT;

-- CreateTable
CREATE TABLE "FotofficeGaleriaCompra" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "galeriaClienteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "extraCount" INTEGER NOT NULL,
    "subtotalArs" DECIMAL(14,2) NOT NULL,
    "discountArs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalArs" DECIMAL(14,2) NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "mpPreferenceId" TEXT,
    "providerPaymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "feeArs" DECIMAL(14,2),
    "netArs" DECIMAL(14,2),
    "cashMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleriaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaCompraFoto" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "fotoId" TEXT NOT NULL,

    CONSTRAINT "FotofficeGaleriaCompraFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeGaleria_incomeCategoryId_idx" ON "FotofficeGaleria"("incomeCategoryId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaAjustes_defaultIncomeCategoryId_idx" ON "FotofficeGaleriaAjustes"("defaultIncomeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaCompra_providerPaymentRef_key" ON "FotofficeGaleriaCompra"("providerPaymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaCompra_cashMovementId_key" ON "FotofficeGaleriaCompra"("cashMovementId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCompra_galeriaClienteId_status_idx" ON "FotofficeGaleriaCompra"("galeriaClienteId", "status");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCompra_galeriaId_status_idx" ON "FotofficeGaleriaCompra"("galeriaId", "status");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCompra_workspaceId_idx" ON "FotofficeGaleriaCompra"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaCompraFoto_compraId_fotoId_key" ON "FotofficeGaleriaCompraFoto"("compraId", "fotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCompraFoto_fotoId_idx" ON "FotofficeGaleriaCompraFoto"("fotoId");

-- AddForeignKey
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaAjustes" ADD CONSTRAINT "FotofficeGaleriaAjustes_defaultIncomeCategoryId_fkey" FOREIGN KEY ("defaultIncomeCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompraFoto" ADD CONSTRAINT "FotofficeGaleriaCompraFoto_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "FotofficeGaleriaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCompraFoto" ADD CONSTRAINT "FotofficeGaleriaCompraFoto_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "FotofficeGaleriaFoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_includedCount" CHECK ("includedCount" >= 0);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_pricingMode" CHECK ("pricingMode" IS NULL OR "pricingMode" IN ('POR_FOTO', 'PAQUETE'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_unitPriceArs" CHECK ("unitPriceArs" IS NULL OR "unitPriceArs" > 0);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_packageSize" CHECK ("packageSize" IS NULL OR "packageSize" >= 2);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_packagePriceArs" CHECK ("packagePriceArs" IS NULL OR "packagePriceArs" > 0);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_discountMode" CHECK ("discountMode" IN ('NINGUNO', 'UNICO', 'PROGRESIVO'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_discountPct" CHECK ("discountPct" IS NULL OR ("discountPct" >= 1 AND "discountPct" <= 90));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_discountRules" CHECK ("discountRules" IS NULL OR (jsonb_typeof("discountRules") = 'array' AND jsonb_array_length("discountRules") <= 4));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_ventaCompleta" CHECK (
  "saleMode" = 'SELECCION'
  OR ("pricingMode" = 'POR_FOTO' AND "unitPriceArs" IS NOT NULL)
  OR ("pricingMode" = 'PAQUETE' AND "packageSize" IS NOT NULL AND "packagePriceArs" IS NOT NULL)
);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_descuentoCompleto" CHECK (
  ("discountMode" = 'NINGUNO')
  OR ("discountMode" = 'UNICO' AND "discountPct" IS NOT NULL)
  OR ("discountMode" = 'PROGRESIVO' AND "discountRules" IS NOT NULL AND jsonb_array_length("discountRules") >= 1)
);
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_status" CHECK ("status" IN ('PENDIENTE', 'PAGADA', 'CANCELADA'));
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_extraCount" CHECK ("extraCount" >= 1);
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_montos" CHECK ("subtotalArs" >= 0 AND "discountArs" >= 0 AND "totalArs" > 0 AND "discountArs" <= "subtotalArs");
ALTER TABLE "FotofficeGaleriaCompra" ADD CONSTRAINT "FotofficeGaleriaCompra_comision" CHECK (("feeArs" IS NULL OR "feeArs" >= 0) AND ("netArs" IS NULL OR "netArs" >= 0));
