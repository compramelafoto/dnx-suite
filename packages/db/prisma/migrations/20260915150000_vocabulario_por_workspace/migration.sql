-- CreateTable
CREATE TABLE "WorkspaceVocabulary" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "personSingular" TEXT,
    "personPlural" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceVocabulary_workspaceId_key" ON "WorkspaceVocabulary"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceVocabulary" ADD CONSTRAINT "WorkspaceVocabulary_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
