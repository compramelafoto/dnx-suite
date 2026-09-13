-- CreateTable
CREATE TABLE "ExpenseVendor" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "billingCurrency" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorAllocation" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "platformKey" TEXT NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "VendorAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amountOriginal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRate" DECIMAL(12,4),
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amountArs" DECIMAL(14,2) NOT NULL,
    "amountRefunded" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'FACTURADO',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "invoiceUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntryAllocation" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "platformKey" TEXT NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,
    "amountArs" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ExpenseEntryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" SERIAL NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "usdToArs" DECIMAL(12,4) NOT NULL,
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVendor_key_key" ON "ExpenseVendor"("key");

-- CreateIndex
CREATE INDEX "ExpenseVendor_active_idx" ON "ExpenseVendor"("active");

-- CreateIndex
CREATE UNIQUE INDEX "VendorAllocation_vendorId_platformKey_key" ON "VendorAllocation"("vendorId", "platformKey");

-- CreateIndex
CREATE INDEX "ExpenseEntry_periodYear_periodMonth_idx" ON "ExpenseEntry"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "ExpenseEntry_status_idx" ON "ExpenseEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntry_vendorId_periodYear_periodMonth_key" ON "ExpenseEntry"("vendorId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "ExpenseEntryAllocation_platformKey_idx" ON "ExpenseEntryAllocation"("platformKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEntryAllocation_entryId_platformKey_key" ON "ExpenseEntryAllocation"("entryId", "platformKey");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_periodYear_periodMonth_key" ON "FxRate"("periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "VendorAllocation" ADD CONSTRAINT "VendorAllocation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ExpenseVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ExpenseVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEntryAllocation" ADD CONSTRAINT "ExpenseEntryAllocation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ExpenseEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

