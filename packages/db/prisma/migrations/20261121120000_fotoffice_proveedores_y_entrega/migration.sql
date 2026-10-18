-- FOTOFFICE: proveedores de trabajos, plazo por producto, entrega prometida y atención al público.
-- Todo nuevo y nullable: sin datos, nada cambia. Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficeProveedor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeProveedor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeProveedor_workspaceId_name_key" ON "FotofficeProveedor"("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "FotofficeProveedor_workspaceId_active_idx" ON "FotofficeProveedor"("workspaceId", "active");
DO $$ BEGIN
  ALTER TABLE "FotofficeProveedor" ADD CONSTRAINT "FotofficeProveedor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FotofficeProductoProyecto" ADD COLUMN IF NOT EXISTS "plazoDias" INTEGER;
ALTER TABLE "FotofficeProductoProyecto" ADD COLUMN IF NOT EXISTS "ultimoPlazoDias" INTEGER;
ALTER TABLE "FotofficeProductoProyecto" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;
DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProyecto" ADD CONSTRAINT "FotofficeProductoProyecto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "entregaPrometida" DATE;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorRef" TEXT;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorCostoArs" DECIMAL(14,2);
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorEnviadoAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "FotofficeProyecto_workspaceId_proveedorId_idx" ON "FotofficeProyecto"("workspaceId", "proveedorId");
DO $$ BEGIN
  ALTER TABLE "FotofficeProyecto" ADD CONSTRAINT "FotofficeProyecto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "atencionDireccion" TEXT;
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "atencionHorario" TEXT;
