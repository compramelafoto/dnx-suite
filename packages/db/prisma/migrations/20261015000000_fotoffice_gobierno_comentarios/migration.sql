-- CreateTable
CREATE TABLE "GovComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "GovComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovComment_projectId_createdAt_idx" ON "GovComment"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "GovComment" ADD CONSTRAINT "GovComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
