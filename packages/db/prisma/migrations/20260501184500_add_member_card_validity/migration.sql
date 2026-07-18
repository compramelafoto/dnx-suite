-- CreateEnum
CREATE TYPE "MemberCardStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MemberCardIssued" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "cardRequestId" TEXT,
    "status" "MemberCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "printedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCardIssued_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberCardIssued_cardRequestId_key" ON "MemberCardIssued"("cardRequestId");

-- CreateIndex
CREATE INDEX "MemberCardIssued_workspaceId_memberId_issuedAt_idx" ON "MemberCardIssued"("workspaceId", "memberId", "issuedAt");

-- CreateIndex
CREATE INDEX "MemberCardIssued_workspaceId_status_validUntil_idx" ON "MemberCardIssued"("workspaceId", "status", "validUntil");

-- AddForeignKey
ALTER TABLE "MemberCardIssued" ADD CONSTRAINT "MemberCardIssued_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCardIssued" ADD CONSTRAINT "MemberCardIssued_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCardIssued" ADD CONSTRAINT "MemberCardIssued_cardRequestId_fkey" FOREIGN KEY ("cardRequestId") REFERENCES "CardRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
