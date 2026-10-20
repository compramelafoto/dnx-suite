-- CreateTable
CREATE TABLE "FotofficePrintSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "paperGlossy" BOOLEAN NOT NULL DEFAULT true,
    "paperMatte" BOOLEAN NOT NULL DEFAULT true,
    "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingBaseArs" DECIMAL(14,2),
    "shippingPerKmArs" DECIMAL(14,2),
    "shippingMaxKm" INTEGER,
    "circuitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePrintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePrintSize" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "widthCm" DECIMAL(6,1) NOT NULL,
    "heightCm" DECIMAL(6,1) NOT NULL,
    "proveedorId" TEXT,
    "costArs" DECIMAL(14,2),
    "priceArs" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePrintSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePrintOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CARPETA',
    "proyectoOrigenId" TEXT,
    "clientId" TEXT,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "paper" TEXT NOT NULL,
    "delivery" TEXT NOT NULL DEFAULT 'RETIRO',
    "subtotalArs" DECIMAL(14,2) NOT NULL,
    "shippingArs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalArs" DECIMAL(14,2) NOT NULL,
    "costTotalArs" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "promisedAt" DATE,
    "pricingSnapshot" JSONB NOT NULL,
    "mpPreferenceId" TEXT,
    "providerPaymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "feeArs" DECIMAL(14,2),
    "netArs" DECIMAL(14,2),
    "cashMovementId" TEXT,
    "trackingToken" TEXT NOT NULL,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePrintOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePrintOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "archivoId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sizeId" TEXT,
    "widthCm" DECIMAL(6,1) NOT NULL,
    "heightCm" DECIMAL(6,1) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceArs" DECIMAL(14,2) NOT NULL,
    "unitCostArs" DECIMAL(14,2) NOT NULL,
    "cropX" DOUBLE PRECISION NOT NULL,
    "cropY" DOUBLE PRECISION NOT NULL,
    "cropW" DOUBLE PRECISION NOT NULL,
    "cropH" DOUBLE PRECISION NOT NULL,
    "proveedorId" TEXT,
    "proyectoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficePrintOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePrintSourceImage" (
    "id" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficePrintSourceImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintSettings_workspaceId_key" ON "FotofficePrintSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficePrintSize_workspaceId_active_idx" ON "FotofficePrintSize"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintSize_workspaceId_widthCm_heightCm_key" ON "FotofficePrintSize"("workspaceId", "widthCm", "heightCm");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintOrder_providerPaymentRef_key" ON "FotofficePrintOrder"("providerPaymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintOrder_cashMovementId_key" ON "FotofficePrintOrder"("cashMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintOrder_trackingToken_key" ON "FotofficePrintOrder"("trackingToken");

-- CreateIndex
CREATE INDEX "FotofficePrintOrder_workspaceId_status_idx" ON "FotofficePrintOrder"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintOrder_workspaceId_number_key" ON "FotofficePrintOrder"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "FotofficePrintOrderItem_orderId_idx" ON "FotofficePrintOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "FotofficePrintOrderItem_proyectoId_idx" ON "FotofficePrintOrderItem"("proyectoId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePrintSourceImage_archivoId_key" ON "FotofficePrintSourceImage"("archivoId");

-- AddForeignKey
ALTER TABLE "FotofficePrintSettings" ADD CONSTRAINT "FotofficePrintSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintSize" ADD CONSTRAINT "FotofficePrintSize_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintSize" ADD CONSTRAINT "FotofficePrintSize_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrder" ADD CONSTRAINT "FotofficePrintOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrder" ADD CONSTRAINT "FotofficePrintOrder_proyectoOrigenId_fkey" FOREIGN KEY ("proyectoOrigenId") REFERENCES "FotofficeProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrder" ADD CONSTRAINT "FotofficePrintOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrder" ADD CONSTRAINT "FotofficePrintOrder_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrderItem" ADD CONSTRAINT "FotofficePrintOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FotofficePrintOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintOrderItem" ADD CONSTRAINT "FotofficePrintOrderItem_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePrintSourceImage" ADD CONSTRAINT "FotofficePrintSourceImage_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "FotofficeArchivoTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

