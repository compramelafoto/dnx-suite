-- Al preparar el pedido para laboratorio: el laboratorio elegido y un mensaje para él.
ALTER TABLE "FotofficePreparacionImpresion" ADD COLUMN IF NOT EXISTS "proveedorId" TEXT;
ALTER TABLE "FotofficePreparacionImpresion" ADD COLUMN IF NOT EXISTS "mensajeProveedor" TEXT;
-- El mensaje queda también en cada trabajo del pedido (lo leen los correos al proveedor).
ALTER TABLE "FotofficeProyecto" ADD COLUMN IF NOT EXISTS "proveedorMensaje" TEXT;
