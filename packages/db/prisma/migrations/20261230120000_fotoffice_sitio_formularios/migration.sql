-- FOTOFFICE · Formularios propios del sitio, boletín y bandeja (PR C de las secciones de Prosite).
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes (la única es entre dos tablas nuevas).
-- Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: sin las tablas, los
-- formularios del sitio responden «no disponible» y la bandeja avisa que falta aplicar el SQL.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR C)

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioFormulario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'SITIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSitioFormulario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioFormularioEnvio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "formularioId" TEXT NOT NULL,
    "datosJson" JSONB NOT NULL,
    "nombre" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "paginaUrl" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "consultaId" TEXT,
    "ipHash" TEXT,
    "claveImportacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeSitioFormularioEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioSuscriptor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "origen" TEXT NOT NULL DEFAULT 'SITIO',
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSitioSuscriptor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioFormulario_workspaceId_clave_key" ON "FotofficeSitioFormulario"("workspaceId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioFormularioEnvio_workspaceId_claveImportacion_key" ON "FotofficeSitioFormularioEnvio"("workspaceId", "claveImportacion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioFormularioEnvio_workspaceId_formularioId_createdAt_idx" ON "FotofficeSitioFormularioEnvio"("workspaceId", "formularioId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioFormularioEnvio_workspaceId_estado_createdAt_idx" ON "FotofficeSitioFormularioEnvio"("workspaceId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioFormularioEnvio_workspaceId_createdAt_idx" ON "FotofficeSitioFormularioEnvio"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioSuscriptor_workspaceId_email_key" ON "FotofficeSitioSuscriptor"("workspaceId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioSuscriptor_workspaceId_estado_createdAt_idx" ON "FotofficeSitioSuscriptor"("workspaceId", "estado", "createdAt");

-- AddForeignKey (entre las dos tablas nuevas; si ya existe, no se vuelve a crear)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeSitioFormularioEnvio_formularioId_fkey') THEN
    ALTER TABLE "FotofficeSitioFormularioEnvio" ADD CONSTRAINT "FotofficeSitioFormularioEnvio_formularioId_fkey"
      FOREIGN KEY ("formularioId") REFERENCES "FotofficeSitioFormulario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
