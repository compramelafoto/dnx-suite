-- CreateTable
CREATE TABLE "VideoRemovalRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "status" "RemovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterPhone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "declarationOk" BOOLEAN NOT NULL DEFAULT false,
    "albumId" INTEGER NOT NULL,
    "videoId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "decidedByUserId" INTEGER,
    "decisionNote" TEXT,

    CONSTRAINT "VideoRemovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoRemovalRequest_photographerId_idx" ON "VideoRemovalRequest"("photographerId");

-- CreateIndex
CREATE INDEX "VideoRemovalRequest_videoId_idx" ON "VideoRemovalRequest"("videoId");

-- CreateIndex
CREATE INDEX "VideoRemovalRequest_albumId_idx" ON "VideoRemovalRequest"("albumId");

-- CreateIndex
CREATE INDEX "VideoRemovalRequest_status_idx" ON "VideoRemovalRequest"("status");

-- AddForeignKey
ALTER TABLE "VideoRemovalRequest" ADD CONSTRAINT "VideoRemovalRequest_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRemovalRequest" ADD CONSTRAINT "VideoRemovalRequest_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRemovalRequest" ADD CONSTRAINT "VideoRemovalRequest_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRemovalRequest" ADD CONSTRAINT "VideoRemovalRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
