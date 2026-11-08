-- Equipo de agentes, pieza 1: cola de propuestas de los agentes (el Periodista propone notas del blog
-- por Telegram). Tabla nueva, sin claves foráneas. Idempotente: se puede correr dos veces.
-- Estados y agentes en TEXT (como el resto de FOTOFFICE) para no crear tipos en las bases compartidas.
CREATE TABLE IF NOT EXISTS "FotofficeAgentePropuesta" (
  "id" TEXT NOT NULL,
  "agente" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PREPARANDO',
  "workspaceId" TEXT NOT NULL,
  "fuenteUrl" TEXT,
  "blogPostId" INTEGER,
  "telegramMessageId" TEXT,
  "correcciones" INTEGER NOT NULL DEFAULT 0,
  "datos" JSONB,
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resueltaEn" TIMESTAMP(3),
  CONSTRAINT "FotofficeAgentePropuesta_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "FotofficeAgentePropuesta"
    ADD CONSTRAINT "FotofficeAgentePropuesta_estado_check"
    CHECK ("estado" IN ('PREPARANDO', 'PENDIENTE', 'PUBLICADA', 'DESCARTADA', 'FALLO'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "FotofficeAgentePropuesta_fuenteUrl_idx" ON "FotofficeAgentePropuesta"("fuenteUrl");
CREATE INDEX IF NOT EXISTS "FotofficeAgentePropuesta_agente_creadaEn_idx" ON "FotofficeAgentePropuesta"("agente", "creadaEn");
