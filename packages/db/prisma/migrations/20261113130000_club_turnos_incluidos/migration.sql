-- Club con turnos incluidos (VIP de una barbería): cada pago abre una bolsa que vence.
-- AlterTable
ALTER TABLE "MemberCategory" ADD COLUMN     "bookingCreditLabel" TEXT,
ADD COLUMN     "bookingCreditValidityDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "bookingCreditsPerPayment" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "creditGrantId" TEXT,
ADD COLUMN     "creditsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MemberBookingCreditGrant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberBookingCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberBookingCreditGrant_paymentId_key" ON "MemberBookingCreditGrant"("paymentId");

-- CreateIndex
CREATE INDEX "MemberBookingCreditGrant_workspaceId_memberId_validUntil_idx" ON "MemberBookingCreditGrant"("workspaceId", "memberId", "validUntil");

-- CreateIndex
CREATE INDEX "Booking_creditGrantId_idx" ON "Booking"("creditGrantId");

-- AddForeignKey
ALTER TABLE "MemberBookingCreditGrant" ADD CONSTRAINT "MemberBookingCreditGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberBookingCreditGrant" ADD CONSTRAINT "MemberBookingCreditGrant_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "MembershipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_creditGrantId_fkey" FOREIGN KEY ("creditGrantId") REFERENCES "MemberBookingCreditGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

