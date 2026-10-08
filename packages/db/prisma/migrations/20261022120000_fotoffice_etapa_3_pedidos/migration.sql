-- Etapa 3 FOTOFFICE · Entrega A: pedidos, plan de cuotas, cobros (recibo X) y rubros de dos niveles.
-- Crea cinco tablas nuevas (`FotofficePedido`, `FotofficePedidoCuota`, `FotofficeCobro`,
-- `FotofficeCobroImputacion` y `FotofficeRubro`) y suma columnas QUE ADMITEN NULO sólo en tablas
-- `Fotoffice*` propias de la Etapa 2:
--   - `FotofficePresupuestoVersion.paymentOptions` y `.chosenPaymentOptionId`;
--   - `FotofficePresupuestoAjustes.paymentOptions`;
--   - `FotofficeProductoCatalogo.incomeCategoryId` (FK a `CashCategory`, ON DELETE SET NULL).
-- No toca `CashCategory`, `CashMovement`, `Product`, `Client` ni `Workspace` (las FKs nacen en las
-- tablas nuevas). No borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-3-PEDIDOS.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/pedidos`, `lib/rubros`): que la suma de las
-- cuotas dé el total, que lo imputado no supere la cuota, que el rubro padre sea del mismo `kind` y
-- workspace y que haya un solo nivel de padre.

-- AlterTable
ALTER TABLE "FotofficeProductoCatalogo" ADD COLUMN     "incomeCategoryId" TEXT;

-- AlterTable
ALTER TABLE "FotofficePresupuestoVersion" ADD COLUMN     "chosenPaymentOptionId" TEXT,
ADD COLUMN     "paymentOptions" JSONB;

-- AlterTable
ALTER TABLE "FotofficePresupuestoAjustes" ADD COLUMN     "paymentOptions" JSONB;

-- CreateTable
CREATE TABLE "FotofficePedido" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "presupuestoId" TEXT,
    "acceptedVersionId" TEXT,
    "consultaLeadId" TEXT,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "cancelReason" TEXT,
    "items" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "totalArs" DECIMAL(12,2) NOT NULL,
    "paymentOption" JSONB,
    "eventDate" DATE,
    "eventLabel" TEXT,
    "incomeCategoryId" TEXT,
    "ownerUserId" INTEGER,
    "accessTokenHash" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePedidoCuota" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "suggestedMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePedidoCuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCobro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "feeArs" DECIMAL(12,2),
    "netArs" DECIMAL(12,2),
    "providerPaymentRef" TEXT,
    "cashMovementId" TEXT,
    "attachmentId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "receiptTokenHash" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidCashMovementId" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCobroImputacion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cobroId" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCobroImputacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeRubro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeRubro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePedido_presupuestoId_key" ON "FotofficePedido"("presupuestoId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePedido_accessTokenHash_key" ON "FotofficePedido"("accessTokenHash");

-- CreateIndex
CREATE INDEX "FotofficePedido_workspaceId_status_idx" ON "FotofficePedido"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FotofficePedido_workspaceId_clientId_idx" ON "FotofficePedido"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "FotofficePedido_workspaceId_consultaLeadId_idx" ON "FotofficePedido"("workspaceId", "consultaLeadId");

-- CreateIndex
CREATE INDEX "FotofficePedido_workspaceId_eventDate_idx" ON "FotofficePedido"("workspaceId", "eventDate");

-- CreateIndex
CREATE INDEX "FotofficePedido_consultaLeadId_idx" ON "FotofficePedido"("consultaLeadId");

-- CreateIndex
CREATE INDEX "FotofficePedido_clientId_idx" ON "FotofficePedido"("clientId");

-- CreateIndex
CREATE INDEX "FotofficePedido_acceptedVersionId_idx" ON "FotofficePedido"("acceptedVersionId");

-- CreateIndex
CREATE INDEX "FotofficePedido_incomeCategoryId_idx" ON "FotofficePedido"("incomeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePedido_workspaceId_number_key" ON "FotofficePedido"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "FotofficePedidoCuota_pedidoId_position_idx" ON "FotofficePedidoCuota"("pedidoId", "position");

-- CreateIndex
CREATE INDEX "FotofficePedidoCuota_workspaceId_dueDate_idx" ON "FotofficePedidoCuota"("workspaceId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_providerPaymentRef_key" ON "FotofficeCobro"("providerPaymentRef");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_cashMovementId_key" ON "FotofficeCobro"("cashMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_receiptTokenHash_key" ON "FotofficeCobro"("receiptTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_voidCashMovementId_key" ON "FotofficeCobro"("voidCashMovementId");

-- CreateIndex
CREATE INDEX "FotofficeCobro_workspaceId_paidAt_idx" ON "FotofficeCobro"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "FotofficeCobro_workspaceId_clientId_idx" ON "FotofficeCobro"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "FotofficeCobro_pedidoId_idx" ON "FotofficeCobro"("pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeCobro_clientId_idx" ON "FotofficeCobro"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeCobro_attachmentId_idx" ON "FotofficeCobro"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_workspaceId_receiptNumber_key" ON "FotofficeCobro"("workspaceId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobro_workspaceId_idempotencyKey_key" ON "FotofficeCobro"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FotofficeCobroImputacion_cuotaId_idx" ON "FotofficeCobroImputacion"("cuotaId");

-- CreateIndex
CREATE INDEX "FotofficeCobroImputacion_workspaceId_idx" ON "FotofficeCobroImputacion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobroImputacion_cobroId_cuotaId_key" ON "FotofficeCobroImputacion"("cobroId", "cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeRubro_categoryId_key" ON "FotofficeRubro"("categoryId");

-- CreateIndex
CREATE INDEX "FotofficeRubro_workspaceId_idx" ON "FotofficeRubro"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeRubro_parentCategoryId_idx" ON "FotofficeRubro"("parentCategoryId");

-- CreateIndex
CREATE INDEX "FotofficeProductoCatalogo_incomeCategoryId_idx" ON "FotofficeProductoCatalogo"("incomeCategoryId");

-- AddForeignKey
ALTER TABLE "FotofficeProductoCatalogo" ADD CONSTRAINT "FotofficeProductoCatalogo_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "FotofficePresupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_acceptedVersionId_fkey" FOREIGN KEY ("acceptedVersionId") REFERENCES "FotofficePresupuestoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_consultaLeadId_fkey" FOREIGN KEY ("consultaLeadId") REFERENCES "ServiceSalesLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_incomeCategoryId_fkey" FOREIGN KEY ("incomeCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoCuota" ADD CONSTRAINT "FotofficePedidoCuota_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoCuota" ADD CONSTRAINT "FotofficePedidoCuota_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_voidCashMovementId_fkey" FOREIGN KEY ("voidCashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "FotofficeAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobroImputacion" ADD CONSTRAINT "FotofficeCobroImputacion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobroImputacion" ADD CONSTRAINT "FotofficeCobroImputacion_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "FotofficeCobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCobroImputacion" ADD CONSTRAINT "FotofficeCobroImputacion_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "FotofficePedidoCuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeRubro" ADD CONSTRAINT "FotofficeRubro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeRubro" ADD CONSTRAINT "FotofficeRubro_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CashCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeRubro" ADD CONSTRAINT "FotofficeRubro_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- CHECK
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_status" CHECK ("status" IN ('CONFIRMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'));
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_cancelReason" CHECK ("status" <> 'CANCELADO' OR "cancelReason" IS NOT NULL);
ALTER TABLE "FotofficePedido" ADD CONSTRAINT "FotofficePedido_totalArs" CHECK ("totalArs" >= 0);
ALTER TABLE "FotofficePedidoCuota" ADD CONSTRAINT "FotofficePedidoCuota_position" CHECK ("position" >= 1);
ALTER TABLE "FotofficePedidoCuota" ADD CONSTRAINT "FotofficePedidoCuota_amountArs" CHECK ("amountArs" > 0);
ALTER TABLE "FotofficePedidoCuota" ADD CONSTRAINT "FotofficePedidoCuota_suggestedMethod" CHECK ("suggestedMethod" IS NULL OR "suggestedMethod" IN ('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO'));
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_method" CHECK ("method" IN ('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO'));
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_amountArs" CHECK ("amountArs" > 0);
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_feeArs" CHECK ("feeArs" IS NULL OR "feeArs" >= 0);
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_netArs" CHECK ("netArs" IS NULL OR "netArs" >= 0);
ALTER TABLE "FotofficeCobro" ADD CONSTRAINT "FotofficeCobro_voidReason" CHECK ("voidedAt" IS NULL OR "voidReason" IS NOT NULL);
ALTER TABLE "FotofficeCobroImputacion" ADD CONSTRAINT "FotofficeCobroImputacion_amountArs" CHECK ("amountArs" > 0);
ALTER TABLE "FotofficeRubro" ADD CONSTRAINT "FotofficeRubro_not_self" CHECK ("parentCategoryId" IS NULL OR "parentCategoryId" <> "categoryId");
