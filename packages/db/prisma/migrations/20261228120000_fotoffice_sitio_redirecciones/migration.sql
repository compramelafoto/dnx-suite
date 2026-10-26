-- FOTOFFICE · Redirecciones del sitio (PR 4 del sitio público: importador de Alboom).
-- Sólo una tabla nueva, sin claves foráneas a tablas existentes. Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falte: sin la tabla no hay
-- redirecciones y el sitio sigue igual.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md (PR 4)

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeSitioRedireccion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "desde" TEXT NOT NULL,
    "hacia" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL DEFAULT 301,
    "origen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeSitioRedireccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSitioRedireccion_workspaceId_desde_key" ON "FotofficeSitioRedireccion"("workspaceId", "desde");

COMMIT;
