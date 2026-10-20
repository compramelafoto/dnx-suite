-- El banner de publicidad del fotógrafo, al pie de la pantalla del invitado.
--
-- Es del vendedor y no del evento: lo pone una vez y aparece en todas sus fiestas. Por
-- eso va en `SubilafotoSellerProfile` y no en `SubilafotoEvent`, y por eso la imagen
-- vive fuera de `eventos/` y no la alcanza el borrado a los 30 días.
--
-- Aditiva e idempotente.

ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "bannerLinkUrl" TEXT;
