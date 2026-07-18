-- CreateEnum
CREATE TYPE "MembershipFeeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "MembershipFee" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "MembershipFeeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipFee_workspaceId_memberId_period_key" ON "MembershipFee"("workspaceId", "memberId", "period");

-- CreateIndex
CREATE INDEX "MembershipFee_workspaceId_period_status_idx" ON "MembershipFee"("workspaceId", "period", "status");

-- CreateIndex
CREATE INDEX "MembershipFee_workspaceId_memberId_idx" ON "MembershipFee"("workspaceId", "memberId");

-- CreateIndex
CREATE INDEX "MembershipFee_workspaceId_dueDate_status_idx" ON "MembershipFee"("workspaceId", "dueDate", "status");

-- AddForeignKey
ALTER TABLE "MembershipFee" ADD CONSTRAINT "MembershipFee_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipFee" ADD CONSTRAINT "MembershipFee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
