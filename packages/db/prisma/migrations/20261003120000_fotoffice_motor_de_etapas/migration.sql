-- Etapa 0.4 FOTOFFICE: motor de etapas. Puramente ADITIVO: nueve tablas nuevas.
-- No altera ServiceSalesLead, Workspace, Client, Member ni User (las FKs nacen en las tablas nuevas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.

-- CreateTable
CREATE TABLE "FotofficeCircuit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeCircuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeStage" (
    "id" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gris',
    "order" INTEGER NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "requireTasks" BOOLEAN NOT NULL DEFAULT false,
    "leadStatus" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeStageTaskTemplate" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "FotofficeStageTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeStageRule" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "event" TEXT NOT NULL,

    CONSTRAINT "FotofficeStageRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeLossReason" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FotofficeLossReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeJourney" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "stageId" TEXT,
    "outcome" TEXT,
    "lossReasonId" TEXT,
    "enteredStageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageDueAt" TIMESTAMP(3),
    "ownerUserId" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeJourneyStep" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "event" TEXT,
    "forcedWithPendingTasks" BOOLEAN NOT NULL DEFAULT false,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeJourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "journeyId" TEXT,
    "stageId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "assigneeUserId" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneByUserId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeProcessedEvent" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeCircuit_workspaceId_kind_isActive_idx" ON "FotofficeCircuit"("workspaceId", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCircuit_workspaceId_name_key" ON "FotofficeCircuit"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeStage_circuitId_order_idx" ON "FotofficeStage"("circuitId", "order");

-- CreateIndex
CREATE INDEX "FotofficeStageTaskTemplate_stageId_order_idx" ON "FotofficeStageTaskTemplate"("stageId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeStageRule_stageId_event_key" ON "FotofficeStageRule"("stageId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeLossReason_workspaceId_name_key" ON "FotofficeLossReason"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "FotofficeJourney_workspaceId_subjectType_subjectId_idx" ON "FotofficeJourney"("workspaceId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "FotofficeJourney_circuitId_stageId_idx" ON "FotofficeJourney"("circuitId", "stageId");

-- CreateIndex
CREATE INDEX "FotofficeJourneyStep_journeyId_createdAt_idx" ON "FotofficeJourneyStep"("journeyId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeTask_workspaceId_assigneeUserId_doneAt_dueAt_idx" ON "FotofficeTask"("workspaceId", "assigneeUserId", "doneAt", "dueAt");

-- CreateIndex
CREATE INDEX "FotofficeTask_journeyId_idx" ON "FotofficeTask"("journeyId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeProcessedEvent_journeyId_event_sourceRef_key" ON "FotofficeProcessedEvent"("journeyId", "event", "sourceRef");

-- AddForeignKey
ALTER TABLE "FotofficeCircuit" ADD CONSTRAINT "FotofficeCircuit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeStage" ADD CONSTRAINT "FotofficeStage_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "FotofficeCircuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeStageTaskTemplate" ADD CONSTRAINT "FotofficeStageTaskTemplate_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FotofficeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeStageRule" ADD CONSTRAINT "FotofficeStageRule_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FotofficeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeLossReason" ADD CONSTRAINT "FotofficeLossReason_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "FotofficeCircuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FotofficeStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_lossReasonId_fkey" FOREIGN KEY ("lossReasonId") REFERENCES "FotofficeLossReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourneyStep" ADD CONSTRAINT "FotofficeJourneyStep_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "FotofficeJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourneyStep" ADD CONSTRAINT "FotofficeJourneyStep_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "FotofficeStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeJourneyStep" ADD CONSTRAINT "FotofficeJourneyStep_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "FotofficeStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeTask" ADD CONSTRAINT "FotofficeTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeTask" ADD CONSTRAINT "FotofficeTask_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "FotofficeJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeTask" ADD CONSTRAINT "FotofficeTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "FotofficeStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeProcessedEvent" ADD CONSTRAINT "FotofficeProcessedEvent_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "FotofficeJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un solo circuito predeterminado por clase y workspace.
CREATE UNIQUE INDEX "FotofficeCircuit_predeterminado" ON "FotofficeCircuit"("workspaceId", "kind") WHERE "isDefault";
-- Un solo recorrido abierto por sujeto y clase.
CREATE UNIQUE INDEX "FotofficeJourney_abierto" ON "FotofficeJourney"("workspaceId", "subjectType", "subjectId", "kind") WHERE "closedAt" IS NULL;
-- Clase y salida válidas.
ALTER TABLE "FotofficeCircuit" ADD CONSTRAINT "FotofficeCircuit_kind" CHECK ("kind" IN ('VENTA','TRABAJO'));
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_outcome" CHECK ("outcome" IS NULL OR "outcome" IN ('GANADA','PERDIDA','TERMINADO','CANCELADO'));
-- Abierto <=> tiene etapa; cerrado <=> tiene salida.
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_estado" CHECK (("closedAt" IS NULL AND "stageId" IS NOT NULL AND "outcome" IS NULL) OR ("closedAt" IS NOT NULL AND "stageId" IS NULL AND "outcome" IS NOT NULL));
