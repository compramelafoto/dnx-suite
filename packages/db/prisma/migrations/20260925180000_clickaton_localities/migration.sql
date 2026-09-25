-- Localidades de los participantes, normalizadas y con coordenadas, para el
-- mapa de la sección Personas.
--
-- Una tabla nueva: no toca ninguna lectura existente.
CREATE TABLE IF NOT EXISTS "ClickatonLocality" (
  "id" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "ciudad" TEXT NOT NULL,
  "provincia" TEXT,
  "pais" TEXT NOT NULL DEFAULT 'AR',
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "origen" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "candidatos" JSONB,
  "revisadaAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonLocality_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonLocality_clave_key"
  ON "ClickatonLocality"("clave");
CREATE INDEX IF NOT EXISTS "ClickatonLocality_estado_idx"
  ON "ClickatonLocality"("estado");
