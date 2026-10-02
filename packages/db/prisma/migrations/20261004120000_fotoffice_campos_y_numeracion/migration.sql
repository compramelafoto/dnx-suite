-- Etapa 0.5 FOTOFFICE: campos personalizados y numeración. Puramente ADITIVO: siete tablas nuevas.
-- No altera ninguna tabla existente (las FKs a Workspace nacen en las tablas nuevas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.

-- CreateTable
CREATE TABLE "FotofficeCustomField" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showInList" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCustomFieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FotofficeCustomFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCustomValue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,4),
    "valueDate" DATE,
    "valueBool" BOOLEAN,
    "optionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficeCustomValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeCustomValueChange" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCustomValueChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeSequence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "withYear" BOOLEAN NOT NULL DEFAULT false,
    "digits" INTEGER NOT NULL DEFAULT 1,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "currentYear" INTEGER,

    CONSTRAINT "FotofficeSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeSequenceChange" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeSequenceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeRecordNumber" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "year" INTEGER,
    "value" INTEGER NOT NULL,
    "display" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeRecordNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeCustomField_workspaceId_entityType_archivedAt_orde_idx" ON "FotofficeCustomField"("workspaceId", "entityType", "archivedAt", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCustomField_workspaceId_entityType_key_key" ON "FotofficeCustomField"("workspaceId", "entityType", "key");

-- CreateIndex
CREATE INDEX "FotofficeCustomFieldOption_fieldId_order_idx" ON "FotofficeCustomFieldOption"("fieldId", "order");

-- CreateIndex
CREATE INDEX "FotofficeCustomValue_workspaceId_entityType_entityId_idx" ON "FotofficeCustomValue"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "FotofficeCustomValue_fieldId_optionId_idx" ON "FotofficeCustomValue"("fieldId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCustomValue_fieldId_entityId_key" ON "FotofficeCustomValue"("fieldId", "entityId");

-- CreateIndex
CREATE INDEX "FotofficeCustomValueChange_workspaceId_entityType_entityId__idx" ON "FotofficeCustomValueChange"("workspaceId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeSequence_workspaceId_key_key" ON "FotofficeSequence"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "FotofficeSequenceChange_workspaceId_key_createdAt_idx" ON "FotofficeSequenceChange"("workspaceId", "key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeRecordNumber_entityType_entityId_key" ON "FotofficeRecordNumber"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "FotofficeCustomField" ADD CONSTRAINT "FotofficeCustomField_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCustomFieldOption" ADD CONSTRAINT "FotofficeCustomFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FotofficeCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCustomValue" ADD CONSTRAINT "FotofficeCustomValue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCustomValue" ADD CONSTRAINT "FotofficeCustomValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FotofficeCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCustomValue" ADD CONSTRAINT "FotofficeCustomValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "FotofficeCustomFieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeCustomValueChange" ADD CONSTRAINT "FotofficeCustomValueChange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSequence" ADD CONSTRAINT "FotofficeSequence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeSequenceChange" ADD CONSTRAINT "FotofficeSequenceChange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeRecordNumber" ADD CONSTRAINT "FotofficeRecordNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Índices únicos parciales: "year" puede ser NULL y en un índice único común los NULL no chocan entre sí.
CREATE UNIQUE INDEX "FotofficeRecordNumber_con_anio" ON "FotofficeRecordNumber"("workspaceId", "sequenceKey", "year", "value") WHERE "year" IS NOT NULL;
CREATE UNIQUE INDEX "FotofficeRecordNumber_sin_anio" ON "FotofficeRecordNumber"("workspaceId", "sequenceKey", "value") WHERE "year" IS NULL;

-- CHECK
ALTER TABLE "FotofficeCustomField" ADD CONSTRAINT "FotofficeCustomField_type" CHECK ("type" IN ('TEXTO', 'TEXTO_LARGO', 'NUMERO', 'FECHA', 'SI_NO', 'LISTA', 'ENLACE'));
ALTER TABLE "FotofficeCustomField" ADD CONSTRAINT "FotofficeCustomField_entityType" CHECK ("entityType" IN ('CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'CONTRATO', 'PROYECTO'));
ALTER TABLE "FotofficeSequence" ADD CONSTRAINT "FotofficeSequence_digits" CHECK ("digits" BETWEEN 1 AND 8);
ALTER TABLE "FotofficeSequence" ADD CONSTRAINT "FotofficeSequence_nextValue" CHECK ("nextValue" >= 1);
