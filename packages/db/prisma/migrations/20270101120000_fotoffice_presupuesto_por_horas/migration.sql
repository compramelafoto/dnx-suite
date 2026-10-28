-- Presupuesto por horas (spec 2026-10-28): ajustes por workspace del armado automático por horas.
ALTER TABLE "FotofficePresupuestoAutoAjustes" ADD COLUMN IF NOT EXISTS "porHoras" JSONB;
