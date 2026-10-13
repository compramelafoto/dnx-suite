-- Agenda de profesionales: parte de cada turno para quien atiende y su liquidación.
-- AlterTable
ALTER TABLE "BookingSpace" ADD COLUMN     "acceptsClubCredits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "professionalShareBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "professionalUserId" INTEGER;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "professionalShareArs" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "professionalShareBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settlementId" TEXT;

-- CreateTable
CREATE TABLE "BookingSettlement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "bookingsCount" INTEGER NOT NULL,
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSettlement_workspaceId_spaceId_paidAt_idx" ON "BookingSettlement"("workspaceId", "spaceId", "paidAt");

-- CreateIndex
CREATE INDEX "Booking_spaceId_settlementId_idx" ON "Booking"("spaceId", "settlementId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "BookingSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

