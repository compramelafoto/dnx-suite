-- CreateTable
CREATE TABLE "FotofficeWorkspaceWebsite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "navJson" JSONB,
    "sectionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWorkspaceWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWorkspaceWebsite_workspaceId_key" ON "FotofficeWorkspaceWebsite"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeWorkspaceWebsite" ADD CONSTRAINT "FotofficeWorkspaceWebsite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
