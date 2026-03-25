-- AlterTable
DO $$ BEGIN
  ALTER TABLE "Order" ADD COLUMN "buyerPhone" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "AbandonedOrderReminder" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "templateUsed" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbandonedOrderReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbandonedOrderReminder_orderId_idx" ON "AbandonedOrderReminder"("orderId");

-- CreateIndex
CREATE INDEX "AbandonedOrderReminder_createdAt_idx" ON "AbandonedOrderReminder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedOrderReminder_orderId_channel_key" ON "AbandonedOrderReminder"("orderId", "channel");

-- AddForeignKey
ALTER TABLE "AbandonedOrderReminder" ADD CONSTRAINT "AbandonedOrderReminder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
