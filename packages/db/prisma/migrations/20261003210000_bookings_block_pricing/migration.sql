-- Cobro por bloque en las reservas, además del cobro por hora.
--
-- Por qué: el estudio se alquila en paquetes de 2 horas y el salón tiene precio plano por
-- jornada. Ninguno de los dos se puede escribir como tarifa horaria —no hay número por hora que
-- dé el mismo total para 3, 4 y 5 horas— y forzarlo obligaba a mostrarle a la gente un precio
-- por hora que no es el que paga.
--
-- Todo arranca en "HOURLY", así que los espacios que ya existen siguen cobrando exactamente
-- igual que antes de esta migración. Los precios de bloque arrancan en 0 y se cargan a mano.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TABLE "BookingSpace"
  ADD COLUMN IF NOT EXISTS "pricingMode"            TEXT NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN IF NOT EXISTS "blockMinutes"           INTEGER,
  ADD COLUMN IF NOT EXISTS "memberBlockPriceArs"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nonMemberBlockPriceArs" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- En la reserva va congelado: si el espacio cambia de modo o de precio, lo ya cobrado no se
-- reescribe.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "pricingModeSnapshot" TEXT NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN IF NOT EXISTS "blockPriceArs"       DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "blocksBilled"        INTEGER;
