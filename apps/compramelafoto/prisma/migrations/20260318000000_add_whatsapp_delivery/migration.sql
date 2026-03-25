-- AlterTable AppConfig: agregar columnas de WhatsApp
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappMaxPhotosToSend" INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappSendInitialMessage" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappSendFinalMessage" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappSendDownloadLinkForLargeOrders" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AppConfig" ADD COLUMN "whatsappDeliveryEnabledForPaidOrders" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- CreateTable
CREATE TABLE "WhatsAppDeliveryLog" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryLog_orderId_idx" ON "WhatsAppDeliveryLog"("orderId");
CREATE INDEX "WhatsAppDeliveryLog_status_idx" ON "WhatsAppDeliveryLog"("status");
CREATE INDEX "WhatsAppDeliveryLog_createdAt_idx" ON "WhatsAppDeliveryLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppDeliveryLog" ADD CONSTRAINT "WhatsAppDeliveryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
