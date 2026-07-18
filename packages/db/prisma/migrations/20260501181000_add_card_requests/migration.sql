-- CreateEnum
CREATE TYPE "CardRequestStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PHOTO_PENDING',
  'PHOTO_REVIEW',
  'APPROVED',
  'REJECTED',
  'READY',
  'DELIVERED'
);

-- CreateTable
CREATE TABLE "CardRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "CardRequestStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "photoUrl" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardRequest_workspaceId_status_idx" ON "CardRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CardRequest_workspaceId_memberId_createdAt_idx" ON "CardRequest"("workspaceId", "memberId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
