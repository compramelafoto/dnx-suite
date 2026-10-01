-- CreateTable
CREATE TABLE "VideoOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "videoId" INTEGER NOT NULL,
    "priceArs" INTEGER NOT NULL DEFAULT 0,
    "feeArs" INTEGER NOT NULL DEFAULT 0,
    "subtotalArs" INTEGER NOT NULL DEFAULT 0,
    "feePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoOrderItem_orderId_videoId_key" ON "VideoOrderItem"("orderId", "videoId");

-- CreateIndex
CREATE INDEX "VideoOrderItem_orderId_idx" ON "VideoOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "VideoOrderItem_videoId_idx" ON "VideoOrderItem"("videoId");

-- AddForeignKey
ALTER TABLE "VideoOrderItem" ADD CONSTRAINT "VideoOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoOrderItem" ADD CONSTRAINT "VideoOrderItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
