-- First-N benefit deadline independent of price-phase window.
ALTER TABLE "ClickatonPricePhaseItem"
ADD COLUMN IF NOT EXISTS "benefitDeadlineAt" TIMESTAMP(3);
