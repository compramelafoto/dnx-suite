-- AlterTable
ALTER TABLE "FotofficePrintOrder" ADD COLUMN     "galeriaId" TEXT,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "shippingKm" DOUBLE PRECISION,
ADD COLUMN     "shippingLat" DOUBLE PRECISION,
ADD COLUMN     "shippingLon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FotofficePrintOrderItem" ADD COLUMN     "galeriaFotoId" TEXT;

-- CreateIndex
CREATE INDEX "FotofficePrintOrder_galeriaId_idx" ON "FotofficePrintOrder"("galeriaId");
