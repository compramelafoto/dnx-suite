-- Add Order.digitalDeliveredAt (IF NOT EXISTS para compatibilidad con baseline)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "digitalDeliveredAt" TIMESTAMP(3);
