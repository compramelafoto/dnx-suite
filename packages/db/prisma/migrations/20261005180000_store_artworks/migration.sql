-- AlterTable
ALTER TABLE "StoreOrderItem" ADD COLUMN     "artworkAuthorUserId" INTEGER,
ADD COLUMN     "artworkListingId" TEXT,
ADD COLUMN     "printFormatId" TEXT,
ADD COLUMN     "printFormatName" TEXT,
ADD COLUMN     "royaltyBps" INTEGER;

-- CreateTable
CREATE TABLE "WorkspaceContestOrganizationLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "linkedByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceContestOrganizationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePrintSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "minDpi" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePrintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintFormat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "widthCm" INTEGER NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "priceArs" DECIMAL(12,2) NOT NULL,
    "costArs" DECIMAL(12,2),
    "weightGrams" INTEGER,
    "packLengthCm" INTEGER,
    "packWidthCm" INTEGER,
    "packHeightCm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestStoreSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "royaltyBps" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestStoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkConsent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkListing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorDisplayName" TEXT,
    "awardLabel" TEXT,
    "previewUrl" TEXT NOT NULL,
    "previewWidth" INTEGER NOT NULL,
    "previewHeight" INTEGER NOT NULL,
    "originalWidth" INTEGER NOT NULL,
    "originalHeight" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkRoyalty" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "contestId" TEXT NOT NULL,
    "baseArs" DECIMAL(12,2) NOT NULL,
    "royaltyBps" INTEGER NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "paidAt" TIMESTAMP(3),
    "paidReference" TEXT,
    "paidByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkRoyalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceContestOrganizationLink_organizationId_idx" ON "WorkspaceContestOrganizationLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceContestOrganizationLink_workspaceId_organizationId_key" ON "WorkspaceContestOrganizationLink"("workspaceId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePrintSettings_workspaceId_key" ON "StorePrintSettings"("workspaceId");

-- CreateIndex
CREATE INDEX "PrintFormat_workspaceId_isActive_idx" ON "PrintFormat"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "ContestStoreSettings_contestId_idx" ON "ContestStoreSettings"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestStoreSettings_workspaceId_contestId_key" ON "ContestStoreSettings"("workspaceId", "contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkConsent_tokenHash_key" ON "ArtworkConsent"("tokenHash");

-- CreateIndex
CREATE INDEX "ArtworkConsent_contestId_idx" ON "ArtworkConsent"("contestId");

-- CreateIndex
CREATE INDEX "ArtworkConsent_entryId_idx" ON "ArtworkConsent"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkConsent_workspaceId_entryId_key" ON "ArtworkConsent"("workspaceId", "entryId");

-- CreateIndex
CREATE INDEX "ArtworkListing_workspaceId_status_idx" ON "ArtworkListing"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ArtworkListing_contestId_idx" ON "ArtworkListing"("contestId");

-- CreateIndex
CREATE INDEX "ArtworkListing_entryId_idx" ON "ArtworkListing"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkListing_workspaceId_entryId_key" ON "ArtworkListing"("workspaceId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkListing_workspaceId_slug_key" ON "ArtworkListing"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkRoyalty_orderItemId_key" ON "ArtworkRoyalty"("orderItemId");

-- CreateIndex
CREATE INDEX "ArtworkRoyalty_workspaceId_status_createdAt_idx" ON "ArtworkRoyalty"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ArtworkRoyalty_orderId_idx" ON "ArtworkRoyalty"("orderId");

-- CreateIndex
CREATE INDEX "ArtworkRoyalty_authorUserId_idx" ON "ArtworkRoyalty"("authorUserId");

-- CreateIndex
CREATE INDEX "ArtworkRoyalty_contestId_idx" ON "ArtworkRoyalty"("contestId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_artworkListingId_idx" ON "StoreOrderItem"("artworkListingId");

-- CreateIndex
CREATE INDEX "StoreOrderItem_printFormatId_idx" ON "StoreOrderItem"("printFormatId");

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_artworkListingId_fkey" FOREIGN KEY ("artworkListingId") REFERENCES "ArtworkListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderItem" ADD CONSTRAINT "StoreOrderItem_printFormatId_fkey" FOREIGN KEY ("printFormatId") REFERENCES "PrintFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceContestOrganizationLink" ADD CONSTRAINT "WorkspaceContestOrganizationLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceContestOrganizationLink" ADD CONSTRAINT "WorkspaceContestOrganizationLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePrintSettings" ADD CONSTRAINT "StorePrintSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintFormat" ADD CONSTRAINT "PrintFormat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestStoreSettings" ADD CONSTRAINT "ContestStoreSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestStoreSettings" ADD CONSTRAINT "ContestStoreSettings_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkConsent" ADD CONSTRAINT "ArtworkConsent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkConsent" ADD CONSTRAINT "ArtworkConsent_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkConsent" ADD CONSTRAINT "ArtworkConsent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkListing" ADD CONSTRAINT "ArtworkListing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkListing" ADD CONSTRAINT "ArtworkListing_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkListing" ADD CONSTRAINT "ArtworkListing_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRoyalty" ADD CONSTRAINT "ArtworkRoyalty_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRoyalty" ADD CONSTRAINT "ArtworkRoyalty_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "StoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRoyalty" ADD CONSTRAINT "ArtworkRoyalty_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "StoreOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRoyalty" ADD CONSTRAINT "ArtworkRoyalty_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

