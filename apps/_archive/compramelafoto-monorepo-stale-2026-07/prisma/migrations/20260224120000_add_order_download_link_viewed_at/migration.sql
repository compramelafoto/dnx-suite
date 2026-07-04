-- Add Order.downloadLinkViewedAt: first time client opened download link or downloaded
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "downloadLinkViewedAt" TIMESTAMP(3);
