-- AlterTable
ALTER TABLE "Member" ADD COLUMN "publicToken" TEXT;

-- CreateTable
CREATE TABLE "MemberCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "showCategory" BOOLEAN NOT NULL DEFAULT true,
    "showStatus" BOOLEAN NOT NULL DEFAULT true,
    "showValidity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_publicToken_key" ON "Member"("publicToken");

-- CreateIndex
CREATE INDEX "Member_workspaceId_publicToken_idx" ON "Member"("workspaceId", "publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "MemberCard_workspaceId_key" ON "MemberCard"("workspaceId");

-- AddForeignKey
ALTER TABLE "MemberCard" ADD CONSTRAINT "MemberCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
