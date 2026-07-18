-- AlterTable
ALTER TABLE "MemberCategory"
ADD COLUMN "enrollmentFeeCents" INTEGER DEFAULT 0,
ADD COLUMN "enrollmentCoversMonths" INTEGER DEFAULT 0,
ADD COLUMN "billingDay" INTEGER DEFAULT 10;

-- CreateEnum
CREATE TYPE "MemberChargeType" AS ENUM ('ENROLLMENT', 'MONTHLY_FEE', 'ADJUSTMENT', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "MemberChargeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MemberPaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'MERCADO_PAGO', 'MANUAL');

-- CreateTable
CREATE TABLE "MemberCharge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "MemberChargeType" NOT NULL,
    "period" TEXT,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "MemberChargeStatus" NOT NULL DEFAULT 'PENDING',
    "coveredFromPeriod" TEXT,
    "coveredToPeriod" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "chargeId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "method" "MemberPaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "externalPaymentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberCharge_workspaceId_period_status_idx" ON "MemberCharge"("workspaceId", "period", "status");

-- CreateIndex
CREATE INDEX "MemberCharge_workspaceId_memberId_status_idx" ON "MemberCharge"("workspaceId", "memberId", "status");

-- CreateIndex
CREATE INDEX "MemberCharge_workspaceId_dueDate_status_idx" ON "MemberCharge"("workspaceId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "MemberPayment_workspaceId_paidAt_idx" ON "MemberPayment"("workspaceId", "paidAt");

-- CreateIndex
CREATE INDEX "MemberPayment_workspaceId_memberId_paidAt_idx" ON "MemberPayment"("workspaceId", "memberId", "paidAt");

-- CreateIndex
CREATE INDEX "MemberPayment_chargeId_idx" ON "MemberPayment"("chargeId");

-- AddForeignKey
ALTER TABLE "MemberCharge" ADD CONSTRAINT "MemberCharge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCharge" ADD CONSTRAINT "MemberCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "MemberCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
