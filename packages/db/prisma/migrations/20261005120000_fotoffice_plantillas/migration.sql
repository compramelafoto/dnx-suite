-- Etapa 0.6 FOTOFFICE: plantillas de mensajes. Puramente ADITIVO: dos tablas nuevas.
-- No altera ninguna tabla existente (las FKs a Workspace nacen en las tablas nuevas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.

-- CreateTable
CREATE TABLE "FotofficeMessageTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "systemKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficeMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "templateId" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT,
    "errorCode" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeMessageTemplate_workspaceId_channel_archivedAt_ord_idx" ON "FotofficeMessageTemplate"("workspaceId", "channel", "archivedAt", "order");

-- CreateIndex
CREATE INDEX "FotofficeMessage_workspaceId_entityType_entityId_createdAt_idx" ON "FotofficeMessage"("workspaceId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeMessage_workspaceId_channel_createdAt_idx" ON "FotofficeMessage"("workspaceId", "channel", "createdAt");

-- AddForeignKey
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeMessage" ADD CONSTRAINT "FotofficeMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeMessage" ADD CONSTRAINT "FotofficeMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FotofficeMessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Índice único parcial: una sola plantilla de sistema por clave y organización.
-- Las plantillas comunes tienen "systemKey" NULL y no chocan entre sí.
CREATE UNIQUE INDEX "FotofficeMessageTemplate_systemKey" ON "FotofficeMessageTemplate"("workspaceId", "systemKey") WHERE "systemKey" IS NOT NULL;

-- CHECK
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_channel" CHECK ("channel" IN ('EMAIL', 'WHATSAPP'));
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA'));
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_subject" CHECK (("channel" = 'EMAIL' AND "subject" IS NOT NULL) OR ("channel" = 'WHATSAPP' AND "subject" IS NULL));
ALTER TABLE "FotofficeMessage" ADD CONSTRAINT "FotofficeMessage_channel" CHECK ("channel" IN ('EMAIL', 'WHATSAPP'));
ALTER TABLE "FotofficeMessage" ADD CONSTRAINT "FotofficeMessage_status" CHECK ("status" IN ('SENT', 'FAILED', 'OPENED_WHATSAPP'));
