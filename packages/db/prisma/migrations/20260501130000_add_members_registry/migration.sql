-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MemberCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyAmountCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberCategory_workspaceId_name_key" ON "MemberCategory"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "MemberCategory_workspaceId_isActive_idx" ON "MemberCategory"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Member_workspaceId_memberNumber_key" ON "Member"("workspaceId", "memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_workspaceId_email_key" ON "Member"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Member_workspaceId_status_idx" ON "Member"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Member_workspaceId_categoryId_idx" ON "Member"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "Member_workspaceId_documentNumber_idx" ON "Member"("workspaceId", "documentNumber");

-- CreateIndex
CREATE INDEX "Member_workspaceId_fullName_idx" ON "Member"("workspaceId", "fullName");

-- AddForeignKey
ALTER TABLE "MemberCategory" ADD CONSTRAINT "MemberCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MemberCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
