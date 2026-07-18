-- AlterTable
ALTER TABLE "CardTemplate"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "CardTemplate_workspaceId_key";

-- AlterTable
ALTER TABLE "MemberCategory"
ADD COLUMN "cardTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "CardTemplate_workspaceId_isDefault_idx" ON "CardTemplate"("workspaceId", "isDefault");

-- CreateIndex
CREATE INDEX "CardTemplate_workspaceId_createdAt_idx" ON "CardTemplate"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberCategory_workspaceId_cardTemplateId_idx" ON "MemberCategory"("workspaceId", "cardTemplateId");

-- AddForeignKey
ALTER TABLE "MemberCategory"
ADD CONSTRAINT "MemberCategory_cardTemplateId_fkey"
FOREIGN KEY ("cardTemplateId") REFERENCES "CardTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
