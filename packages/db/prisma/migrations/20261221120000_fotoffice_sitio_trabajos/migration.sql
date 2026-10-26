-- FOTOFFICE · Trabajos del sitio (portfolio del estudio en el sitio público).
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes. Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: el sitio muestra vacío.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md (PR 2)

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTrabajoCategoria" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "portadaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTrabajoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTrabajo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lugar" TEXT,
    "fecha" DATE,
    "descripcionHtml" TEXT,
    "portadaUrl" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "vistas" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "origenExterno" TEXT,
    "origenExternoId" TEXT,
    "publicadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTrabajoFoto" (
    "id" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'FOTO',
    "url" TEXT NOT NULL,
    "r2Key" TEXT,
    "ancho" INTEGER,
    "alto" INTEGER,
    "alt" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "origenUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeTrabajoFoto_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeTrabajoCategoria_workspaceId_orden_idx" ON "FotofficeTrabajoCategoria"("workspaceId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTrabajoCategoria_workspaceId_slug_key" ON "FotofficeTrabajoCategoria"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeTrabajo_workspaceId_estado_fecha_idx" ON "FotofficeTrabajo"("workspaceId", "estado", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTrabajo_workspaceId_slug_key" ON "FotofficeTrabajo"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTrabajo_workspaceId_origenExterno_origenExternoId_key" ON "FotofficeTrabajo"("workspaceId", "origenExterno", "origenExternoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeTrabajoFoto_trabajoId_orden_idx" ON "FotofficeTrabajoFoto"("trabajoId", "orden");
