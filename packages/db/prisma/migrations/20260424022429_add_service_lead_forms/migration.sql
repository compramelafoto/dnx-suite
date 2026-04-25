-- AlterTable
ALTER TABLE "ServiceSalesLead" ADD COLUMN     "formId" TEXT,
ADD COLUMN     "formSlug" TEXT;

-- CreateTable
CREATE TABLE "ServiceLeadForm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceLeadForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLeadForm_workspaceId_isActive_idx" ON "ServiceLeadForm"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceLeadForm_workspaceId_eventType_idx" ON "ServiceLeadForm"("workspaceId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLeadForm_workspaceId_slug_key" ON "ServiceLeadForm"("workspaceId", "slug");

-- AddForeignKey
ALTER TABLE "ServiceSalesLead" ADD CONSTRAINT "ServiceSalesLead_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ServiceLeadForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLeadForm" ADD CONSTRAINT "ServiceLeadForm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
