-- Etapa 1 FOTOFFICE: contactos y consultas. Puramente ADITIVO: siete tablas nuevas.
-- No altera ninguna tabla existente: `ServiceSalesLead` y `Client` no reciben columnas (las FKs a
-- Workspace, ServiceSalesLead y Client nacen en las tablas nuevas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.
-- Los clientes que ya existen no tienen perfil: el código los trata como CLIENTE (el default de la
-- columna); los que crea una consulta nacen con perfil CONTACTO.

-- CreateTable
CREATE TABLE "FotofficeConsulta" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "originId" TEXT,
    "referrerClientId" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "expectedCloseDate" DATE,
    "eventStartsAt" TIMESTAMP(3),
    "eventTimeKnown" BOOLEAN NOT NULL DEFAULT false,
    "venue" TEXT,
    "ceremonyVenue" TEXT,
    "receptionVenue" TEXT,
    "city" TEXT,
    "guests" INTEGER,
    "partnerOneName" TEXT,
    "partnerTwoName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeConsulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeConsultaCategoria" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "legacyEventType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeConsultaCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeOrigen" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeOrigen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeRolParticipante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeRolParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeConsultaParticipante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeConsultaParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContactoPerfil" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CLIENTE',
    "mobile" TEXT,
    "email2" TEXT,
    "birthday" DATE,
    "website" TEXT,
    "province" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "about" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeContactoPerfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeConsultaAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultOwnerUserId" INTEGER,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "createTask" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeConsultaAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeConsulta_leadId_key" ON "FotofficeConsulta"("leadId");

-- CreateIndex
CREATE INDEX "FotofficeConsulta_workspaceId_clientId_idx" ON "FotofficeConsulta"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "FotofficeConsulta_workspaceId_categoryId_idx" ON "FotofficeConsulta"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "FotofficeConsulta_workspaceId_originId_idx" ON "FotofficeConsulta"("workspaceId", "originId");

-- CreateIndex
CREATE INDEX "FotofficeConsulta_workspaceId_eventStartsAt_idx" ON "FotofficeConsulta"("workspaceId", "eventStartsAt");

-- CreateIndex
CREATE INDEX "FotofficeConsultaCategoria_workspaceId_archivedAt_order_idx" ON "FotofficeConsultaCategoria"("workspaceId", "archivedAt", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeConsultaCategoria_workspaceId_name_key" ON "FotofficeConsultaCategoria"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeOrigen_workspaceId_archivedAt_order_idx" ON "FotofficeOrigen"("workspaceId", "archivedAt", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeOrigen_workspaceId_name_key" ON "FotofficeOrigen"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeRolParticipante_workspaceId_archivedAt_order_idx" ON "FotofficeRolParticipante"("workspaceId", "archivedAt", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeRolParticipante_workspaceId_name_key" ON "FotofficeRolParticipante"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeConsultaParticipante_workspaceId_clientId_idx" ON "FotofficeConsultaParticipante"("workspaceId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeConsultaParticipante_consultaId_clientId_roleId_key" ON "FotofficeConsultaParticipante"("consultaId", "clientId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContactoPerfil_clientId_key" ON "FotofficeContactoPerfil"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeContactoPerfil_workspaceId_category_idx" ON "FotofficeContactoPerfil"("workspaceId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeConsultaAjustes_workspaceId_key" ON "FotofficeConsultaAjustes"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceSalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_referrerClientId_fkey" FOREIGN KEY ("referrerClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotofficeConsultaCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_originId_fkey" FOREIGN KEY ("originId") REFERENCES "FotofficeOrigen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaCategoria" ADD CONSTRAINT "FotofficeConsultaCategoria_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeOrigen" ADD CONSTRAINT "FotofficeOrigen_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeRolParticipante" ADD CONSTRAINT "FotofficeRolParticipante_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaParticipante" ADD CONSTRAINT "FotofficeConsultaParticipante_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaParticipante" ADD CONSTRAINT "FotofficeConsultaParticipante_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "FotofficeConsulta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaParticipante" ADD CONSTRAINT "FotofficeConsultaParticipante_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaParticipante" ADD CONSTRAINT "FotofficeConsultaParticipante_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "FotofficeRolParticipante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContactoPerfil" ADD CONSTRAINT "FotofficeContactoPerfil_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContactoPerfil" ADD CONSTRAINT "FotofficeContactoPerfil_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeConsultaAjustes" ADD CONSTRAINT "FotofficeConsultaAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK
ALTER TABLE "FotofficeConsultaCategoria" ADD CONSTRAINT "FotofficeConsultaCategoria_group" CHECK ("group" IN ('BODA', 'EVENTO', 'TRABAJO_CON_FECHA', 'TRABAJO_SIN_FECHA'));
ALTER TABLE "FotofficeContactoPerfil" ADD CONSTRAINT "FotofficeContactoPerfil_category" CHECK ("category" IN ('CONTACTO', 'CLIENTE', 'PROVEEDOR', 'COLABORADOR'));
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_guests" CHECK ("guests" IS NULL OR "guests" >= 0);
ALTER TABLE "FotofficeConsulta" ADD CONSTRAINT "FotofficeConsulta_estimatedValue" CHECK ("estimatedValue" IS NULL OR "estimatedValue" >= 0);
