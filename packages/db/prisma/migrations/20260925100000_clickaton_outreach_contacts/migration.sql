-- Contactos de otras plataformas de la casa a los que contarles que existe
-- Clickatón.
--
-- Se copian acá en vez de leerse en vivo porque cada plataforma vive en su
-- propia base de Neon y las cuentas no se comparten. La copia deja además
-- registro de a quién se le escribió y de quién pidió no recibir más.
--
-- Una tabla nueva: no toca ninguna lectura existente.
CREATE TABLE IF NOT EXISTS "ClickatonOutreachContact" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "origen" TEXT NOT NULL,
  "lastSentAt" TIMESTAMP(3),
  "lastCampaign" TEXT,
  "optedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonOutreachContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonOutreachContact_email_key"
  ON "ClickatonOutreachContact"("email");
CREATE INDEX IF NOT EXISTS "ClickatonOutreachContact_origen_idx"
  ON "ClickatonOutreachContact"("origen");
CREATE INDEX IF NOT EXISTS "ClickatonOutreachContact_lastSentAt_idx"
  ON "ClickatonOutreachContact"("lastSentAt");
CREATE INDEX IF NOT EXISTS "ClickatonOutreachContact_optedOutAt_idx"
  ON "ClickatonOutreachContact"("optedOutAt");
