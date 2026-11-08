-- Cierre del circuito de pedidos a proveedores: material físico y seguimiento de apertura/descarga.
ALTER TABLE "FotofficeProductoProyecto" ADD COLUMN IF NOT EXISTS "envioSinArchivos" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorAbiertoAt" TIMESTAMP(3);
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorDescargadoAt" TIMESTAMP(3);
