-- Etapa 3 FOTOFFICE · Entrega B1: cuentas a pagar, recordatorios de cuotas, ajustes de pedidos y
-- checklist del pedido.
-- Crea cuatro tablas nuevas (`FotofficeCuentaPagar`, `FotofficeCuotaRecordatorio`,
-- `FotofficePedidoAjustes` y `FotofficePedidoTarea`). NO suma columnas a ninguna tabla existente
-- (tampoco a las `Fotoffice*` de la Entrega A): las FKs nacen en las tablas nuevas. No borra nada ni
-- actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md`, "Entrega B1").
-- Lo que el SQL no puede chequear lo valida el código (`lib/pedidos`): que el pedido, el proveedor, el
-- costo-plantilla y el rubro sean del mismo workspace, que el rubro de costo sea de egreso y el formato
-- de las plantillas de checklist.

-- CreateTable
CREATE TABLE "FotofficeCuentaPagar" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "supplierClientId" TEXT,
    "costoPlantillaId" TEXT,
    "concept" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE,
    "costCategoryId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidMethod" TEXT,
    "paidCashMovementId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidCashMovementId" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCuentaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCuotaRecordatorio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCuotaRecordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePedidoAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reminderDays" INTEGER NOT NULL DEFAULT 1,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "incomeCategoryId" TEXT,
    "checklistTemplates" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePedidoAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePedidoTarea" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "doneByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePedidoTarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCuentaPagar_paidCashMovementId_key" ON "FotofficeCuentaPagar"("paidCashMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCuentaPagar_voidCashMovementId_key" ON "FotofficeCuentaPagar"("voidCashMovementId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_workspaceId_dueDate_idx" ON "FotofficeCuentaPagar"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_workspaceId_supplierClientId_idx" ON "FotofficeCuentaPagar"("workspaceId", "supplierClientId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_workspaceId_pedidoId_idx" ON "FotofficeCuentaPagar"("workspaceId", "pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_pedidoId_idx" ON "FotofficeCuentaPagar"("pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_supplierClientId_idx" ON "FotofficeCuentaPagar"("supplierClientId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_costoPlantillaId_idx" ON "FotofficeCuentaPagar"("costoPlantillaId");

-- CreateIndex
CREATE INDEX "FotofficeCuentaPagar_costCategoryId_idx" ON "FotofficeCuentaPagar"("costCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCuentaPagar_workspaceId_idempotencyKey_key" ON "FotofficeCuentaPagar"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FotofficeCuotaRecordatorio_workspaceId_idx" ON "FotofficeCuotaRecordatorio"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCuotaRecordatorio_cuotaId_dueDate_key" ON "FotofficeCuotaRecordatorio"("cuotaId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePedidoAjustes_workspaceId_key" ON "FotofficePedidoAjustes"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficePedidoAjustes_incomeCategoryId_idx" ON "FotofficePedidoAjustes"("incomeCategoryId");

-- CreateIndex
CREATE INDEX "FotofficePedidoTarea_pedidoId_position_idx" ON "FotofficePedidoTarea"("pedidoId", "position");

-- CreateIndex
CREATE INDEX "FotofficePedidoTarea_workspaceId_idx" ON "FotofficePedidoTarea"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_supplierClientId_fkey" FOREIGN KEY ("supplierClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_costoPlantillaId_fkey" FOREIGN KEY ("costoPlantillaId") REFERENCES "FotofficeCostoPlantilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_paidCashMovementId_fkey" FOREIGN KEY ("paidCashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_voidCashMovementId_fkey" FOREIGN KEY ("voidCashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuotaRecordatorio" ADD CONSTRAINT "FotofficeCuotaRecordatorio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCuotaRecordatorio" ADD CONSTRAINT "FotofficeCuotaRecordatorio_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "FotofficePedidoCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoAjustes" ADD CONSTRAINT "FotofficePedidoAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoAjustes" ADD CONSTRAINT "FotofficePedidoAjustes_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoTarea" ADD CONSTRAINT "FotofficePedidoTarea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoTarea" ADD CONSTRAINT "FotofficePedidoTarea_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_amountArs" CHECK ("amountArs" > 0);
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_paidMethod" CHECK ("paidMethod" IS NULL OR "paidMethod" IN ('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO'));
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_paid" CHECK (("paidAt" IS NULL) = ("paidMethod" IS NULL));
ALTER TABLE "FotofficeCuentaPagar" ADD CONSTRAINT "FotofficeCuentaPagar_voidReason" CHECK ("voidedAt" IS NULL OR "voidReason" IS NOT NULL);
ALTER TABLE "FotofficePedidoAjustes" ADD CONSTRAINT "FotofficePedidoAjustes_reminderDays" CHECK ("reminderDays" BETWEEN 0 AND 30);
ALTER TABLE "FotofficePedidoTarea" ADD CONSTRAINT "FotofficePedidoTarea_position" CHECK ("position" >= 1);
ALTER TABLE "FotofficePedidoTarea" ADD CONSTRAINT "FotofficePedidoTarea_title" CHECK (length(trim("title")) > 0);
