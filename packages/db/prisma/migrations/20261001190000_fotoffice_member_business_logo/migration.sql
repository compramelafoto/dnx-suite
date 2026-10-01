-- Logo de la empresa del socio: lo sube desde su portal y se muestra junto al nombre del negocio.
-- Opcional y sin valor por omisión: ningún socio existente queda afectado.

ALTER TABLE "Member" ADD COLUMN "businessLogoUrl" TEXT;
