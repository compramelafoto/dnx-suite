-- Probador de cuadros: pedidos pagos (spec 2026-10-30-probador-de-cuadros-v2, etapa 3).
-- Dos columnas opcionales: no tocan los pedidos que ya existen.
ALTER TABLE "FotofficePrintOrder" ADD COLUMN IF NOT EXISTS "composicion" JSONB;
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN IF NOT EXISTS "probador" JSONB;
