-- El logo del aliado viaja con el premio.
--
-- La columna ya existe en las tres bases que comparten el esquema: la creó a mano la
-- migración `20260915000000_sorteos_logo` del PR de avisos del sorteo, que todavía no llegó a
-- main. `IF NOT EXISTS` deja esta migración idempotente: aplicarla donde ya está no hace nada.
ALTER TABLE "RafflePrize" ADD COLUMN IF NOT EXISTS "partnerLogoSnapshot" TEXT;
