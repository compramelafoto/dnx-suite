-- Clickatón — plantilla Template V2 asignada a las placas de una edición.
--
-- Contexto: hasta ahora el diseño de las placas de bienvenida y «Soy parte»
-- estaba fijo en el código (presets oficiales). Esta tabla permite que la
-- organización elija, por edición, una plantilla diseñada en el editor visual
-- Template V2, cuyas filas ya viven en esta misma base.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — nada cambia hasta que se asigne una plantilla:
--   * Sólo se crea una tabla nueva; no se modifica ni se lee ninguna existente.
--   * Sin fila para (edición, tipo de placa), la placa sigue usando el preset
--     del código exactamente como hasta ahora.
--   * `enabled = false` permite desactivar la plantilla sin perder la elección.
--
-- `templateId` / `versionId` son referencias blandas a TemplateV2: el editor
-- pertenece a otra app del monorepo y no se fuerza integridad referencial entre
-- dominios. `versionId` nulo significa «seguir la versión vigente».

CREATE TABLE "ClickatonCardTemplateAssignment" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "cardType" "ClickatonParticipantCardType" NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "assignedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonCardTemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- Una sola plantilla por edición y tipo de placa.
CREATE UNIQUE INDEX "ClickatonCardTemplateAssignment_editionId_cardType_key"
    ON "ClickatonCardTemplateAssignment"("editionId", "cardType");

CREATE INDEX "ClickatonCardTemplateAssignment_templateId_idx"
    ON "ClickatonCardTemplateAssignment"("templateId");

ALTER TABLE "ClickatonCardTemplateAssignment"
    ADD CONSTRAINT "ClickatonCardTemplateAssignment_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
