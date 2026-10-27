-- FOTOFFICE · Contador de visitas por página y documentos del sitio (PR D de las secciones de Prosite).
-- Sólo tablas nuevas, sin claves foráneas. Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: sin las tablas, el
-- contador responde 204 sin contar, el enlace de un documento da «no encontrado» y las pantallas
-- del panel avisan que falta aplicar el SQL.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR D)

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioVisita" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "visitas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FotofficeSitioVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioDocumento" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "descargas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSitioDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioVisita_workspaceId_ruta_fecha_key" ON "FotofficeSitioVisita"("workspaceId", "ruta", "fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioVisita_workspaceId_fecha_idx" ON "FotofficeSitioVisita"("workspaceId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioDocumento_workspaceId_slug_key" ON "FotofficeSitioDocumento"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeSitioDocumento_workspaceId_createdAt_idx" ON "FotofficeSitioDocumento"("workspaceId", "createdAt");

COMMIT;
