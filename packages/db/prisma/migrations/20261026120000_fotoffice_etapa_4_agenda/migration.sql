-- Etapa 4 FOTOFFICE · Entrega B: agenda.
-- Crea seis tablas nuevas (`FotofficeCitaTipo`, `FotofficeCita`, `FotofficeCitaParticipante`,
-- `FotofficeProductoCita`, `FotofficeAgendaAjustes` y `FotofficeCitaRecordatorio`) y reemplaza el CHECK de
-- `FotofficeMessageTemplate.entityType` por la misma lista de la Entrega A más 'CITA'. NO suma columnas a
-- ninguna tabla existente: las FKs nacen en las tablas nuevas. No borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-4-AGENDA.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/agenda`): que el contacto, el pedido, el
-- proyecto, el tipo y la regla sean del mismo workspace.
-- Los únicos con columnas nulas (`googleEventId`; `pedidoId`, `pedidoItemIndex`, `reglaId`) no chocan entre
-- sí en Postgres: las citas sueltas no se ven afectadas.


-- CreateTable
CREATE TABLE "FotofficeCitaTipo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCitaTipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCita" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "typeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGENDADA',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "notes" TEXT,
    "ownerUserId" INTEGER,
    "clientId" TEXT,
    "proyectoId" TEXT,
    "pedidoId" TEXT,
    "consultaLeadId" TEXT,
    "reglaId" TEXT,
    "pedidoItemIndex" INTEGER,
    "googleEventId" TEXT,
    "googleEtag" TEXT,
    "googleUpdatedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCitaParticipante" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "userId" INTEGER,
    "clientId" TEXT,
    "roleId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCitaParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProductoCita" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "typeId" TEXT,
    "title" TEXT,
    "daysFromEvent" INTEGER NOT NULL DEFAULT 0,
    "startTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "ownerUserId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProductoCita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeAgendaAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "googleCalendarId" TEXT,
    "googleSyncToken" TEXT,
    "googleLastSyncAt" TIMESTAMP(3),
    "defaultLayers" JSONB,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAgendaAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCitaRecordatorio" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCitaRecordatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCitaTipo_workspaceId_name_key" ON "FotofficeCitaTipo"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeCita_workspaceId_startAt_idx" ON "FotofficeCita"("workspaceId", "startAt");

-- CreateIndex
CREATE INDEX "FotofficeCita_workspaceId_ownerUserId_startAt_idx" ON "FotofficeCita"("workspaceId", "ownerUserId", "startAt");

-- CreateIndex
CREATE INDEX "FotofficeCita_typeId_idx" ON "FotofficeCita"("typeId");

-- CreateIndex
CREATE INDEX "FotofficeCita_clientId_idx" ON "FotofficeCita"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeCita_proyectoId_idx" ON "FotofficeCita"("proyectoId");

-- CreateIndex
CREATE INDEX "FotofficeCita_pedidoId_idx" ON "FotofficeCita"("pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeCita_consultaLeadId_idx" ON "FotofficeCita"("consultaLeadId");

-- CreateIndex
CREATE INDEX "FotofficeCita_reglaId_idx" ON "FotofficeCita"("reglaId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCita_workspaceId_googleEventId_key" ON "FotofficeCita"("workspaceId", "googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCita_pedidoId_pedidoItemIndex_reglaId_key" ON "FotofficeCita"("pedidoId", "pedidoItemIndex", "reglaId");

-- CreateIndex
CREATE INDEX "FotofficeCitaParticipante_citaId_idx" ON "FotofficeCitaParticipante"("citaId");

-- CreateIndex
CREATE INDEX "FotofficeCitaParticipante_userId_idx" ON "FotofficeCitaParticipante"("userId");

-- CreateIndex
CREATE INDEX "FotofficeCitaParticipante_clientId_idx" ON "FotofficeCitaParticipante"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeCitaParticipante_roleId_idx" ON "FotofficeCitaParticipante"("roleId");

-- CreateIndex
CREATE INDEX "FotofficeProductoCita_workspaceId_productId_order_idx" ON "FotofficeProductoCita"("workspaceId", "productId", "order");

-- CreateIndex
CREATE INDEX "FotofficeProductoCita_productId_idx" ON "FotofficeProductoCita"("productId");

-- CreateIndex
CREATE INDEX "FotofficeProductoCita_typeId_idx" ON "FotofficeProductoCita"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeAgendaAjustes_workspaceId_key" ON "FotofficeAgendaAjustes"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCitaRecordatorio_citaId_startAt_key" ON "FotofficeCitaRecordatorio"("citaId", "startAt");

-- AddForeignKey
ALTER TABLE "FotofficeCitaTipo" ADD CONSTRAINT "FotofficeCitaTipo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "FotofficeCitaTipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_consultaLeadId_fkey" FOREIGN KEY ("consultaLeadId") REFERENCES "ServiceSalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_reglaId_fkey" FOREIGN KEY ("reglaId") REFERENCES "FotofficeProductoCita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCitaParticipante" ADD CONSTRAINT "FotofficeCitaParticipante_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "FotofficeCita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCitaParticipante" ADD CONSTRAINT "FotofficeCitaParticipante_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCitaParticipante" ADD CONSTRAINT "FotofficeCitaParticipante_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "FotofficeProyectoRol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "FotofficeCitaTipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeAgendaAjustes" ADD CONSTRAINT "FotofficeAgendaAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCitaRecordatorio" ADD CONSTRAINT "FotofficeCitaRecordatorio_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "FotofficeCita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeCitaTipo" ADD CONSTRAINT "FotofficeCitaTipo_color" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE "FotofficeCitaTipo" ADD CONSTRAINT "FotofficeCitaTipo_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_status" CHECK ("status" IN ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'ANULADA'));
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_rango" CHECK ("endAt" > "startAt");
ALTER TABLE "FotofficeCita" ADD CONSTRAINT "FotofficeCita_title" CHECK (length(trim("title")) > 0);
ALTER TABLE "FotofficeCitaParticipante" ADD CONSTRAINT "FotofficeCitaParticipante_persona" CHECK (("userId" IS NULL) <> ("clientId" IS NULL));
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_daysFromEvent" CHECK ("daysFromEvent" BETWEEN -365 AND 365);
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_durationMinutes" CHECK ("durationMinutes" BETWEEN 15 AND 1440);
ALTER TABLE "FotofficeProductoCita" ADD CONSTRAINT "FotofficeProductoCita_startTime" CHECK ("startTime" IS NULL OR "startTime" ~ '^[0-2][0-9]:[0-5][0-9]$');
ALTER TABLE "FotofficeAgendaAjustes" ADD CONSTRAINT "FotofficeAgendaAjustes_reminderHours" CHECK ("reminderHours" BETWEEN 1 AND 168);
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA'));
