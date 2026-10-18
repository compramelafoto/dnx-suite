-- FOTOFFICE: color propio del panel por negocio. Nullable: sin valor, nada cambia. Idempotente.
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "panelColor" TEXT;
