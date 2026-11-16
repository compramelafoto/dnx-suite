-- FOTOFFICE: portfolios del estudio (rubros y etiquetas internas de los trabajos). Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficePortfolioRubro" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "enlacesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficePortfolioRubro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePortfolioRubro_workspaceId_nombre_key" ON "FotofficePortfolioRubro"("workspaceId", "nombre");
CREATE INDEX IF NOT EXISTS "FotofficePortfolioRubro_workspaceId_orden_idx" ON "FotofficePortfolioRubro"("workspaceId", "orden");

CREATE TABLE IF NOT EXISTS "FotofficeTrabajoPortfolio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trabajoId" TEXT NOT NULL,
    "rubroId" TEXT,
    "estilos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeTrabajoPortfolio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTrabajoPortfolio_trabajoId_key" ON "FotofficeTrabajoPortfolio"("trabajoId");
CREATE INDEX IF NOT EXISTS "FotofficeTrabajoPortfolio_workspaceId_rubroId_idx" ON "FotofficeTrabajoPortfolio"("workspaceId", "rubroId");

DO $$ BEGIN
  ALTER TABLE "FotofficePortfolioRubro" ADD CONSTRAINT "FotofficePortfolioRubro_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTrabajoPortfolio" ADD CONSTRAINT "FotofficeTrabajoPortfolio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
