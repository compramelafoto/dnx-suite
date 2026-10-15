-- Sorteos: quien ganó un premio no puede volver a ganar ese mismo premio por N meses.
ALTER TABLE "RaffleEntry" ADD COLUMN IF NOT EXISTS "excludedPrizeOrders" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "RaffleSettings" ADD COLUMN IF NOT EXISTS "samePrizeCooldownMonths" INTEGER NOT NULL DEFAULT 0;
