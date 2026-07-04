-- CreateEnum
CREATE TYPE "PrintOrderOwnerType" AS ENUM ('PHOTOGRAPHER', 'LAB');

-- AlterTable
ALTER TABLE "PrintOrder" ADD COLUMN "ownerType" "PrintOrderOwnerType",
ADD COLUMN "ownerId" INTEGER;
