-- Cuaderno privado del participante durante la maratón: una fila por consigna.
-- Guarda el texto libre y el check "Ya la tengo" juntos porque son la misma cosa:
-- el estado de esa persona frente a esa consigna.
--
-- `clientUpdatedAt` es la hora del dispositivo que escribió. Sirve para resolver
-- el conflicto entre el teléfono en la calle y la computadora en casa: gana la
-- escritura más reciente.
CREATE TABLE IF NOT EXISTS "ClickatonPromptNote" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "clientUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonPromptNote_pkey" PRIMARY KEY ("id")
);

-- Una sola nota por consigna y participante: el guardado automático hace UPSERT.
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonPromptNote_registrationId_promptId_key"
    ON "ClickatonPromptNote"("registrationId", "promptId");

-- El borrado a los 30 días recorre por edición.
CREATE INDEX IF NOT EXISTS "ClickatonPromptNote_editionId_idx"
    ON "ClickatonPromptNote"("editionId");

ALTER TABLE "ClickatonPromptNote"
    ADD CONSTRAINT "ClickatonPromptNote_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClickatonPromptNote"
    ADD CONSTRAINT "ClickatonPromptNote_registrationId_fkey"
    FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClickatonPromptNote"
    ADD CONSTRAINT "ClickatonPromptNote_promptId_fkey"
    FOREIGN KEY ("promptId") REFERENCES "ClickatonPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
