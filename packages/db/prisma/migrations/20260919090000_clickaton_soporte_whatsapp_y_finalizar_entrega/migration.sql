-- Botón "pedir ayuda": WhatsApp de soporte configurable por edición.
ALTER TABLE "ClickatonEdition" ADD COLUMN IF NOT EXISTS "supportWhatsappPhone" TEXT;

-- "Terminé de subir mis fotos": declaración explícita del participante.
ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "submissionFinalizedAt" TIMESTAMP(3);
