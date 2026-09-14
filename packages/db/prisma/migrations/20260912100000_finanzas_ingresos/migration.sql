-- CreateTable
CREATE TABLE "PlatformRevenueSnapshot" (
    "id" SERIAL NOT NULL,
    "platformKey" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "grossArs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "processorFeeArs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payoutToThirdPartiesArs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netArs" DECIMAL(14,2) NOT NULL,
    "operationsCount" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceNote" TEXT,

    CONSTRAINT "PlatformRevenueSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformRevenueSnapshot_periodYear_periodMonth_idx" ON "PlatformRevenueSnapshot"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRevenueSnapshot_platformKey_periodYear_periodMonth_key" ON "PlatformRevenueSnapshot"("platformKey", "periodYear", "periodMonth");

