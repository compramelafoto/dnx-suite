-- Conexión de Mercado Pago del vendedor de Subí la Foto.
--
-- El token va cifrado en `mpCredential` (AES-GCM del vault de @repo/payments),
-- no en texto plano: con ese token se puede cobrar en nombre del vendedor.
--
-- No se reutilizan los campos `mpAccessToken` de `User` a propósito. Son de la
-- aplicación de Mercado Pago de CompraMeLaFoto: pisarlos rompería sus cobros,
-- porque los tokens no son intercambiables entre aplicaciones distintas.
--
-- Todas las columnas son opcionales: la tabla ya tiene filas y ninguna se toca.

ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "mpUserId" TEXT;
ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "mpCredential" JSONB;
ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "mpConnectedAt" TIMESTAMP(3);
ALTER TABLE "SubilafotoSellerProfile" ADD COLUMN IF NOT EXISTS "mpTokenExpiresAt" TIMESTAMP(3);
