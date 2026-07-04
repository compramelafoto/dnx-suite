-- AlterTable
ALTER TABLE "Album" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Album_deletedAt_idx" ON "Album"("deletedAt");
