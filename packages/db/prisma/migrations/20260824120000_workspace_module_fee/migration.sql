-- CreateTable
CREATE TABLE "WorkspaceModuleFee" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceModuleFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceModuleFee_workspaceId_idx" ON "WorkspaceModuleFee"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceModuleFee_workspaceId_moduleKey_key" ON "WorkspaceModuleFee"("workspaceId", "moduleKey");

-- AddForeignKey
ALTER TABLE "WorkspaceModuleFee" ADD CONSTRAINT "WorkspaceModuleFee_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
