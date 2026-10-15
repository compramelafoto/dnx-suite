-- AlterTable
ALTER TABLE "GovProject" ADD COLUMN "fundingIdea" TEXT,
ADD COLUMN "proposerCommitment" TEXT;

-- CreateTable
CREATE TABLE "GovComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "authorMemberId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "GovComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMemberVote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovMemberVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovComment_projectId_createdAt_idx" ON "GovComment"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "GovComment" ADD CONSTRAINT "GovComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "GovMemberVote_projectId_memberId_key" ON "GovMemberVote"("projectId", "memberId");

-- AddForeignKey
ALTER TABLE "GovMemberVote" ADD CONSTRAINT "GovMemberVote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
