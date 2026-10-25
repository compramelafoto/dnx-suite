-- Etapa 5 FOTOFFICE: contratos.
-- Crea siete tablas nuevas (`FotofficeContratoPlantilla`, `FotofficePedidoContratante`, `FotofficeContrato`,
-- `FotofficeContratoVersion`, `FotofficeContratoFirmante`, `FotofficeContratoEvento` y `FotofficeContratoAjustes`)
-- y reemplaza el CHECK de `FotofficeMessageTemplate.entityType` por la misma lista de la Etapa 4 más 'CONTRATO'.
-- NO suma columnas a ninguna tabla existente: las FKs nacen en las tablas nuevas. No borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-5-CONTRATOS.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/contratos`): que el pedido, el contacto y la
-- plantilla sean del mismo workspace, y que la versión vigente sea del propio contrato.

-- CreateTable
CREATE TABLE "FotofficeContratoPlantilla" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeContratoPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficePedidoContratante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficePedidoContratante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContrato" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "bodyText" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "pdfKey" TEXT,
    "pdfHash" TEXT,
    "pdfSentAt" TIMESTAMP(3),
    "manualSignedAt" TIMESTAMP(3),
    "manualAttachmentId" TEXT,
    "ownerUserId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContratoVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "bodyText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "FotofficeContratoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContratoFirmante" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "docNumber" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "codesSentInWindow" INTEGER NOT NULL DEFAULT 0,
    "codeWindowStart" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "typedName" TEXT,
    "signatureKey" TEXT,
    "signedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "lastReminderAt" TIMESTAMP(3),

    CONSTRAINT "FotofficeContratoFirmante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContratoEvento" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "firmanteId" TEXT,
    "actorUserId" INTEGER,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeContratoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeContratoAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companySignatureKey" TEXT,
    "companyName" TEXT,
    "companyTaxId" TEXT,
    "companyAddress" TEXT,
    "consentClause" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeContratoAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContratoPlantilla_workspaceId_name_key" ON "FotofficeContratoPlantilla"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficePedidoContratante_workspaceId_idx" ON "FotofficePedidoContratante"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficePedidoContratante_clientId_idx" ON "FotofficePedidoContratante"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePedidoContratante_pedidoId_orden_key" ON "FotofficePedidoContratante"("pedidoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContrato_currentVersionId_key" ON "FotofficeContrato"("currentVersionId");

-- CreateIndex
CREATE INDEX "FotofficeContrato_workspaceId_status_idx" ON "FotofficeContrato"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FotofficeContrato_pedidoId_idx" ON "FotofficeContrato"("pedidoId");

-- CreateIndex
CREATE INDEX "FotofficeContrato_clientId_idx" ON "FotofficeContrato"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeContrato_templateId_idx" ON "FotofficeContrato"("templateId");

-- CreateIndex
CREATE INDEX "FotofficeContrato_manualAttachmentId_idx" ON "FotofficeContrato"("manualAttachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContrato_workspaceId_number_key" ON "FotofficeContrato"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "FotofficeContratoVersion_workspaceId_idx" ON "FotofficeContratoVersion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContratoVersion_contratoId_number_key" ON "FotofficeContratoVersion"("contratoId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContratoFirmante_tokenHash_key" ON "FotofficeContratoFirmante"("tokenHash");

-- CreateIndex
CREATE INDEX "FotofficeContratoFirmante_workspaceId_idx" ON "FotofficeContratoFirmante"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeContratoFirmante_versionId_idx" ON "FotofficeContratoFirmante"("versionId");

-- CreateIndex
CREATE INDEX "FotofficeContratoFirmante_clientId_idx" ON "FotofficeContratoFirmante"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeContratoEvento_contratoId_createdAt_idx" ON "FotofficeContratoEvento"("contratoId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeContratoEvento_workspaceId_idx" ON "FotofficeContratoEvento"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeContratoAjustes_workspaceId_key" ON "FotofficeContratoAjustes"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeContratoPlantilla" ADD CONSTRAINT "FotofficeContratoPlantilla_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoContratante" ADD CONSTRAINT "FotofficePedidoContratante_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoContratante" ADD CONSTRAINT "FotofficePedidoContratante_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficePedidoContratante" ADD CONSTRAINT "FotofficePedidoContratante_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FotofficeContratoPlantilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "FotofficeContratoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_manualAttachmentId_fkey" FOREIGN KEY ("manualAttachmentId") REFERENCES "FotofficeAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoVersion" ADD CONSTRAINT "FotofficeContratoVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoVersion" ADD CONSTRAINT "FotofficeContratoVersion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "FotofficeContrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FotofficeContratoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoEvento" ADD CONSTRAINT "FotofficeContratoEvento_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoEvento" ADD CONSTRAINT "FotofficeContratoEvento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "FotofficeContrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeContratoAjustes" ADD CONSTRAINT "FotofficeContratoAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeContratoPlantilla" ADD CONSTRAINT "FotofficeContratoPlantilla_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeContratoPlantilla" ADD CONSTRAINT "FotofficeContratoPlantilla_body" CHECK (length(trim("body")) > 0);
ALTER TABLE "FotofficePedidoContratante" ADD CONSTRAINT "FotofficePedidoContratante_orden" CHECK ("orden" IN (1, 2));
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_status" CHECK ("status" IN ('BORRADOR', 'ENVIADO', 'FIRMADO_PARCIAL', 'FIRMADO', 'RECHAZADO', 'ANULADO'));
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeContrato" ADD CONSTRAINT "FotofficeContrato_voidReason" CHECK ("voidedAt" IS NULL OR ("voidReason" IS NOT NULL AND length(trim("voidReason")) > 0));
ALTER TABLE "FotofficeContratoVersion" ADD CONSTRAINT "FotofficeContratoVersion_contentHash" CHECK ("contentHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_orden" CHECK ("orden" IN (1, 2));
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_codeAttempts" CHECK ("codeAttempts" >= 0);
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_codesSentInWindow" CHECK ("codesSentInWindow" >= 0);
ALTER TABLE "FotofficeContratoFirmante" ADD CONSTRAINT "FotofficeContratoFirmante_rejectReason" CHECK ("rejectedAt" IS NULL OR ("rejectReason" IS NOT NULL AND length(trim("rejectReason")) > 0));
ALTER TABLE "FotofficeContratoAjustes" ADD CONSTRAINT "FotofficeContratoAjustes_reminderDays" CHECK ("reminderDays" BETWEEN 1 AND 30);
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA', 'CONTRATO'));
