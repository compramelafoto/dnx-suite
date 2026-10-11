-- El banner del proveedor, para el pie del teléfono del invitado.
--
-- Va en la participación y no en `DnxPartner` por dos motivos: `DnxPartner` es un modelo
-- compartido con las otras apps de la suite y esto es de SubiLaFoto, y porque el
-- proveedor completa una ficha **por evento** — puede querer un banner distinto en un
-- casamiento que en un cumpleaños de quince.
--
-- Es lo que el fotógrafo les ofrece a cambio de completar la ficha. Hasta ahora lo único
-- que recibían era un renglón al pie del álbum.
ALTER TABLE "SubilafotoEventVendor" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
ALTER TABLE "SubilafotoEventVendor" ADD COLUMN IF NOT EXISTS "bannerLinkUrl" TEXT;
