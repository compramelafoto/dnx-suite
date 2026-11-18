-- FOTOFFICE · Digitalización: precio de un cassette que no se pudo digitalizar.
-- Sólo la base de FOTOFFICE tiene estas tablas. Idempotente.
-- precioNoDigitalizableArs: lo que se cobra por un cassette que no funcionó; null = se cobra completo.
-- bonificacionArs: lo que se le descontó al pedido por ese cassette (para poder deshacerlo al «Quitar»).
ALTER TABLE "DigitalizacionAjustes" ADD COLUMN IF NOT EXISTS "precioNoDigitalizableArs" DECIMAL(12,2);
ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "bonificacionArs" DECIMAL(12,2);

DO $$ BEGIN
  ALTER TABLE "DigitalizacionAjustes" ADD CONSTRAINT "DigitalizacionAjustes_precioNoDigitalizableArs"
    CHECK ("precioNoDigitalizableArs" IS NULL OR "precioNoDigitalizableArs" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_bonificacionArs"
    CHECK ("bonificacionArs" IS NULL OR "bonificacionArs" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
