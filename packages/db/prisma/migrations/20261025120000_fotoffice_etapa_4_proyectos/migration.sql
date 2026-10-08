-- Etapa 4 FOTOFFICE · Entrega A: proyectos.
-- Crea siete tablas nuevas (`FotofficeProyecto`, `FotofficeProductoProyecto`, `FotofficeProyectoRol`,
-- `FotofficeProyectoParticipante`, `FotofficeProyectoNota`, `FotofficeProyectoAdjunto` y
-- `FotofficeProyectoEtapaPlan`) y reemplaza el CHECK de `FotofficeMessageTemplate.entityType` por la misma
-- lista de la Etapa 3 más 'PROYECTO'. NO suma columnas a ninguna tabla existente: las FKs nacen en las
-- tablas nuevas. No borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-4-PROYECTOS.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/proyectos`): que el contacto, el pedido, el
-- producto, el flujo (de TRABAJO) y los roles sean del mismo workspace.
-- Los únicos con columnas nulas (`pedidoId`, `pedidoItemIndex`) no chocan entre sí en Postgres: los
-- proyectos sueltos (sin pedido) no se ven afectados.

warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateTable
CREATE TABLE "FotofficeProyecto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "pedidoItemIndex" INTEGER,
    "productId" TEXT,
    "circuitId" TEXT NOT NULL,
    "eventDate" DATE,
    "baseDate" DATE NOT NULL,
    "finalDueDate" DATE,
    "ownerUserId" INTEGER,
    "delegateUserId" INTEGER,
    "description" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "externalId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProductoProyecto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "ownerUserId" INTEGER,
    "daysFromEvent" INTEGER NOT NULL DEFAULT 0,
    "nameTemplate" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProductoProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProyectoRol" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProyectoRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProyectoParticipante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "userId" INTEGER,
    "clientId" TEXT,
    "roleId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeProyectoParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProyectoNota" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProyectoNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProyectoAdjunto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "uploadedByUserId" INTEGER,
    "uploadedByLabel" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeProyectoAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProyectoEtapaPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "plannedDueDate" DATE NOT NULL,

    CONSTRAINT "FotofficeProyectoEtapaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeProyecto_workspaceId_finalDueDate_idx" ON "FotofficeProyecto"("workspaceId", "finalDueDate");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_workspaceId_clientId_idx" ON "FotofficeProyecto"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_workspaceId_pedidoId_idx" ON "FotofficeProyecto"("workspaceId", "pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_workspaceId_ownerUserId_idx" ON "FotofficeProyecto"("workspaceId", "ownerUserId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_clientId_idx" ON "FotofficeProyecto"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_pedidoId_idx" ON "FotofficeProyecto"("pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_productId_idx" ON "FotofficeProyecto"("productId");

-- CreateIndex
CREATE INDEX "FotofficeProyecto_circuitId_idx" ON "FotofficeProyecto"("circuitId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProyecto_workspaceId_number_key" ON "FotofficeProyecto"("workspaceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProyecto_pedidoId_pedidoItemIndex_circuitId_key" ON "FotofficeProyecto"("pedidoId", "pedidoItemIndex", "circuitId");

-- CreateIndex
CREATE INDEX "FotofficeProductoProyecto_workspaceId_productId_order_idx" ON "FotofficeProductoProyecto"("workspaceId", "productId", "order");

-- CreateIndex
CREATE INDEX "FotofficeProductoProyecto_productId_idx" ON "FotofficeProductoProyecto"("productId");

-- CreateIndex
CREATE INDEX "FotofficeProductoProyecto_circuitId_idx" ON "FotofficeProductoProyecto"("circuitId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProyectoRol_workspaceId_name_key" ON "FotofficeProyectoRol"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeProyectoParticipante_workspaceId_proyectoId_idx" ON "FotofficeProyectoParticipante"("workspaceId", "proyectoId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoParticipante_workspaceId_userId_idx" ON "FotofficeProyectoParticipante"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoParticipante_proyectoId_idx" ON "FotofficeProyectoParticipante"("proyectoId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoParticipante_clientId_idx" ON "FotofficeProyectoParticipante"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoParticipante_roleId_idx" ON "FotofficeProyectoParticipante"("roleId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoNota_proyectoId_createdAt_idx" ON "FotofficeProyectoNota"("proyectoId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeProyectoNota_workspaceId_idx" ON "FotofficeProyectoNota"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProyectoAdjunto_storageKey_key" ON "FotofficeProyectoAdjunto"("storageKey");

-- CreateIndex
CREATE INDEX "FotofficeProyectoAdjunto_workspaceId_proyectoId_createdAt_idx" ON "FotofficeProyectoAdjunto"("workspaceId", "proyectoId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeProyectoAdjunto_proyectoId_idx" ON "FotofficeProyectoAdjunto"("proyectoId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoAdjunto_status_purgeAfter_idx" ON "FotofficeProyectoAdjunto"("status", "purgeAfter");

-- CreateIndex
CREATE INDEX "FotofficeProyectoEtapaPlan_workspaceId_idx" ON "FotofficeProyectoEtapaPlan"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeProyectoEtapaPlan_stageId_idx" ON "FotofficeProyectoEtapaPlan"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProyectoEtapaPlan_proyectoId_stageId_key" ON "FotofficeProyectoEtapaPlan"("proyectoId", "stageId");

-- AddForeignKey
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "FotofficeCircuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoProyecto" ADD CONSTRAINT "FotofficeProductoProyecto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoProyecto" ADD CONSTRAINT "FotofficeProductoProyecto_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoProyecto" ADD CONSTRAINT "FotofficeProductoProyecto_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "FotofficeCircuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoRol" ADD CONSTRAINT "FotofficeProyectoRol_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoParticipante" ADD CONSTRAINT "FotofficeProyectoParticipante_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoParticipante" ADD CONSTRAINT "FotofficeProyectoParticipante_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoParticipante" ADD CONSTRAINT "FotofficeProyectoParticipante_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoParticipante" ADD CONSTRAINT "FotofficeProyectoParticipante_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "FotofficeProyectoRol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoNota" ADD CONSTRAINT "FotofficeProyectoNota_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoNota" ADD CONSTRAINT "FotofficeProyectoNota_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoAdjunto" ADD CONSTRAINT "FotofficeProyectoAdjunto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoAdjunto" ADD CONSTRAINT "FotofficeProyectoAdjunto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoEtapaPlan" ADD CONSTRAINT "FotofficeProyectoEtapaPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoEtapaPlan" ADD CONSTRAINT "FotofficeProyectoEtapaPlan_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProyectoEtapaPlan" ADD CONSTRAINT "FotofficeProyectoEtapaPlan_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FotofficeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_suspendReason" CHECK ("suspendedAt" IS NULL OR "suspendReason" IS NOT NULL);
ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeProductoProyecto" ADD CONSTRAINT "FotofficeProductoProyecto_daysFromEvent" CHECK ("daysFromEvent" BETWEEN -365 AND 365);
ALTER TABLE "FotofficeProyectoParticipante" ADD CONSTRAINT "FotofficeProyectoParticipante_persona" CHECK (("userId" IS NULL) <> ("clientId" IS NULL));
ALTER TABLE "FotofficeProyectoNota" ADD CONSTRAINT "FotofficeProyectoNota_body" CHECK (length(trim("body")) > 0);
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO'));
