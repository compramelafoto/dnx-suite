-- Add print toggles on User and Lab
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showCarnetPrints" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showPolaroidPrints" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "showCarnetPrints" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lab" ADD COLUMN IF NOT EXISTS "showPolaroidPrints" BOOLEAN NOT NULL DEFAULT false;

-- Add metadata + expiry for print order items
ALTER TABLE "PrintOrderItem" ADD COLUMN IF NOT EXISTS "meta" JSONB;
ALTER TABLE "PrintOrderItem" ADD COLUMN IF NOT EXISTS "printExpiresAt" TIMESTAMPTZ;

-- Add photobook documents table
CREATE TABLE IF NOT EXISTS "PhotobookDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotobookDocument_pkey" PRIMARY KEY ("id")
);
