-- Etapa 2 FOTOFFICE · Entrega A: catálogo ampliado y presupuestos. Puramente ADITIVO: siete tablas nuevas.
-- No altera ninguna tabla existente: `Product`, `Client` y `ServiceSalesLead` no reciben columnas (las FKs
-- nacen en las tablas nuevas). Sin `FotofficePropuestaModelo` (llega con la Entrega B).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.
-- El modo de precio de cada ítem (LISTA | CALCULO) vive dentro del JSON `items` y no se puede chequear
-- acá: lo valida el código (`lib/presupuestos/constantes.ts`). Lo mismo los ciclos de combos y que el
-- proveedor de un costo sea del mismo workspace (`lib/catalogo/`).

-- CreateTable
CREATE TABLE "FotofficeProductoCatalogo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inPriceList" BOOLEAN NOT NULL DEFAULT false,
    "incomeLabel" TEXT,
    "isCombo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProductoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeComboItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "comboProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeComboItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCostoPlantilla" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierClientId" TEXT,
    "concept" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "perUnit" BOOLEAN NOT NULL DEFAULT false,
    "daysFromEvent" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCostoPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePresupuesto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "consultaLeadId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "currentVersionId" TEXT,
    "acceptedVersionId" TEXT,
    "ownerUserId" INTEGER,
    "validUntil" DATE,
    "pedidoPorConfirmar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePresupuestoVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "terms" TEXT,
    "paymentProposal" TEXT,
    "costSnapshot" JSONB,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedName" TEXT,
    "acceptedIpHash" TEXT,
    "acceptedUserAgent" TEXT,

    CONSTRAINT "FotofficePresupuestoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePresupuestoVista" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "FotofficePresupuestoVista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePresupuestoAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 15,
    "terms" TEXT,
    "paymentProposal" TEXT,
    "followUpDays" INTEGER NOT NULL DEFAULT 3,
    "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePresupuestoAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProductoCatalogo_productId_key" ON "FotofficeProductoCatalogo"("productId");

-- CreateIndex
CREATE INDEX "FotofficeProductoCatalogo_workspaceId_inPriceList_idx" ON "FotofficeProductoCatalogo"("workspaceId", "inPriceList");

-- CreateIndex
CREATE INDEX "FotofficeComboItem_workspaceId_componentProductId_idx" ON "FotofficeComboItem"("workspaceId", "componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeComboItem_comboProductId_componentProductId_key" ON "FotofficeComboItem"("comboProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "FotofficeCostoPlantilla_workspaceId_productId_order_idx" ON "FotofficeCostoPlantilla"("workspaceId", "productId", "order");

-- CreateIndex
CREATE INDEX "FotofficeCostoPlantilla_workspaceId_supplierClientId_idx" ON "FotofficeCostoPlantilla"("workspaceId", "supplierClientId");

-- CreateIndex
CREATE INDEX "FotofficeCostoPlantilla_productId_idx" ON "FotofficeCostoPlantilla"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePresupuesto_currentVersionId_key" ON "FotofficePresupuesto"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePresupuesto_acceptedVersionId_key" ON "FotofficePresupuesto"("acceptedVersionId");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_workspaceId_status_idx" ON "FotofficePresupuesto"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_workspaceId_consultaLeadId_idx" ON "FotofficePresupuesto"("workspaceId", "consultaLeadId");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_workspaceId_clientId_idx" ON "FotofficePresupuesto"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_workspaceId_validUntil_idx" ON "FotofficePresupuesto"("workspaceId", "validUntil");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_consultaLeadId_idx" ON "FotofficePresupuesto"("consultaLeadId");

-- CreateIndex
CREATE INDEX "FotofficePresupuesto_clientId_idx" ON "FotofficePresupuesto"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePresupuestoVersion_tokenHash_key" ON "FotofficePresupuestoVersion"("tokenHash");

-- CreateIndex
CREATE INDEX "FotofficePresupuestoVersion_workspaceId_sentAt_idx" ON "FotofficePresupuestoVersion"("workspaceId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePresupuestoVersion_presupuestoId_number_key" ON "FotofficePresupuestoVersion"("presupuestoId", "number");

-- CreateIndex
CREATE INDEX "FotofficePresupuestoVista_versionId_viewedAt_idx" ON "FotofficePresupuestoVista"("versionId", "viewedAt");

-- CreateIndex
CREATE INDEX "FotofficePresupuestoVista_workspaceId_viewedAt_idx" ON "FotofficePresupuestoVista"("workspaceId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePresupuestoAjustes_workspaceId_key" ON "FotofficePresupuestoAjustes"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeProductoCatalogo" ADD CONSTRAINT "FotofficeProductoCatalogo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoCatalogo" ADD CONSTRAINT "FotofficeProductoCatalogo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeComboItem" ADD CONSTRAINT "FotofficeComboItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeComboItem" ADD CONSTRAINT "FotofficeComboItem_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeComboItem" ADD CONSTRAINT "FotofficeComboItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCostoPlantilla" ADD CONSTRAINT "FotofficeCostoPlantilla_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCostoPlantilla" ADD CONSTRAINT "FotofficeCostoPlantilla_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCostoPlantilla" ADD CONSTRAINT "FotofficeCostoPlantilla_supplierClientId_fkey" FOREIGN KEY ("supplierClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_consultaLeadId_fkey" FOREIGN KEY ("consultaLeadId") REFERENCES "ServiceSalesLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "FotofficePresupuestoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_acceptedVersionId_fkey" FOREIGN KEY ("acceptedVersionId") REFERENCES "FotofficePresupuestoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuestoVersion" ADD CONSTRAINT "FotofficePresupuestoVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuestoVersion" ADD CONSTRAINT "FotofficePresupuestoVersion_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "FotofficePresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuestoVista" ADD CONSTRAINT "FotofficePresupuestoVista_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuestoVista" ADD CONSTRAINT "FotofficePresupuestoVista_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FotofficePresupuestoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePresupuestoAjustes" ADD CONSTRAINT "FotofficePresupuestoAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK
ALTER TABLE "FotofficePresupuesto" ADD CONSTRAINT "FotofficePresupuesto_status" CHECK ("status" IN ('BORRADOR', 'ENVIADO', 'VISTO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO'));
ALTER TABLE "FotofficePresupuestoVersion" ADD CONSTRAINT "FotofficePresupuestoVersion_number" CHECK ("number" >= 1);
ALTER TABLE "FotofficePresupuestoVersion" ADD CONSTRAINT "FotofficePresupuestoVersion_acceptedAt" CHECK ("acceptedAt" IS NULL OR "sentAt" IS NOT NULL);
ALTER TABLE "FotofficeComboItem" ADD CONSTRAINT "FotofficeComboItem_quantity" CHECK ("quantity" > 0);
ALTER TABLE "FotofficeComboItem" ADD CONSTRAINT "FotofficeComboItem_not_self" CHECK ("comboProductId" <> "componentProductId");
ALTER TABLE "FotofficeCostoPlantilla" ADD CONSTRAINT "FotofficeCostoPlantilla_amountArs" CHECK ("amountArs" >= 0);
ALTER TABLE "FotofficePresupuestoAjustes" ADD CONSTRAINT "FotofficePresupuestoAjustes_validityDays" CHECK ("validityDays" BETWEEN 1 AND 365);
ALTER TABLE "FotofficePresupuestoAjustes" ADD CONSTRAINT "FotofficePresupuestoAjustes_followUpDays" CHECK ("followUpDays" BETWEEN 1 AND 90);
