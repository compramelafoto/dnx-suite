-- CreateTable
CREATE TABLE "WorkspaceContestShowcase" (
    "workspaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ALL',
    "organizationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeClickaton" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceContestShowcase_pkey" PRIMARY KEY ("workspaceId")
);

-- AddForeignKey
ALTER TABLE "WorkspaceContestShowcase" ADD CONSTRAINT "WorkspaceContestShowcase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

