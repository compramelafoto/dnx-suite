-- CreateEnum
CREATE TYPE "PrintPricingSource" AS ENUM ('PHOTOGRAPHER', 'LAB_PREFERRED');

-- AlterTable
ALTER TABLE "Album" ADD COLUMN "printPricingSource" "PrintPricingSource" NOT NULL DEFAULT 'PHOTOGRAPHER';
