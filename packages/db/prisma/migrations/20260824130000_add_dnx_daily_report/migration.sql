-- CreateEnum
CREATE TYPE "DnxDailyReportStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DnxDailyReportDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DnxDailyReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "status" "DnxDailyReportStatus" NOT NULL DEFAULT 'COMPLETE',
    "payload" JSONB NOT NULL,
    "generationMs" INTEGER NOT NULL DEFAULT 0,
    "failedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalAlerts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxDailyReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnxDailyReportDelivery" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipient" TEXT NOT NULL,
    "status" "DnxDailyReportDeliveryStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnxDailyReportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DnxDailyReportSnapshot_reportDate_key" ON "DnxDailyReportSnapshot"("reportDate");

-- CreateIndex
CREATE INDEX "DnxDailyReportSnapshot_createdAt_idx" ON "DnxDailyReportSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "DnxDailyReportSnapshot_status_idx" ON "DnxDailyReportSnapshot"("status");

-- CreateIndex
CREATE INDEX "DnxDailyReportDelivery_snapshotId_idx" ON "DnxDailyReportDelivery"("snapshotId");

-- CreateIndex
CREATE INDEX "DnxDailyReportDelivery_status_sentAt_idx" ON "DnxDailyReportDelivery"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "DnxDailyReportDelivery" ADD CONSTRAINT "DnxDailyReportDelivery_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DnxDailyReportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
