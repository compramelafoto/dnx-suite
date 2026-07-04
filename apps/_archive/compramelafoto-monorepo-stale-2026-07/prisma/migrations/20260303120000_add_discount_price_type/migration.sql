-- Add priceType to LabSizeDiscount (PROFESSIONAL = fotógrafo, PUBLIC = público)
ALTER TABLE "LabSizeDiscount" ADD COLUMN "priceType" TEXT NOT NULL DEFAULT 'PROFESSIONAL';

-- Drop old unique constraint
DROP INDEX IF EXISTS "LabSizeDiscount_labId_size_minQty_key";

-- Create new unique constraint including priceType
CREATE UNIQUE INDEX "LabSizeDiscount_labId_size_minQty_priceType_key" ON "LabSizeDiscount"("labId", "size", "minQty", "priceType");
