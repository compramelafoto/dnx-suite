-- FOTOFFICE: carpeta de archivos de cada trabajo (reemplaza los links de Google Drive). Idempotente.
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "carpetaClienteEmitida" TIMESTAMP(3);
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "carpetaClienteHash" TEXT;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "carpetaLabEmitida" TIMESTAMP(3);
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "carpetaLabHash" TEXT;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "carpetaVence" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeProyecto_carpetaClienteHash_key" ON "FotofficeProyecto"("carpetaClienteHash");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeProyecto_carpetaLabHash_key" ON "FotofficeProyecto"("carpetaLabHash");

CREATE TABLE IF NOT EXISTS "FotofficeArchivoTrabajo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "uploadedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeArchivoTrabajo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeArchivoTrabajo_key_key" ON "FotofficeArchivoTrabajo"("key");
CREATE INDEX IF NOT EXISTS "FotofficeArchivoTrabajo_proyectoId_createdAt_idx" ON "FotofficeArchivoTrabajo"("proyectoId", "createdAt");
CREATE INDEX IF NOT EXISTS "FotofficeArchivoTrabajo_workspaceId_estado_idx" ON "FotofficeArchivoTrabajo"("workspaceId", "estado");
DO $$ BEGIN
  ALTER TABLE "FotofficeArchivoTrabajo" ADD CONSTRAINT "FotofficeArchivoTrabajo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeArchivoTrabajo" ADD CONSTRAINT "FotofficeArchivoTrabajo_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
