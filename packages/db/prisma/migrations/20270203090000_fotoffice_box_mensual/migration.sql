-- BOX mensual del club de SOYBELUZ: qué categorías llevan caja, el catálogo de cajas
-- (FotofficeBox) y el envío de cada caja a cada persona socia (FotofficeBoxShipment).
-- Todo aditivo: una columna con valor por omisión y dos tablas nuevas.
-- Idempotente: se puede correr dos veces.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FotofficeBoxShipmentStatus" AS ENUM ('ENVIADA', 'ENTREGADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "MemberCategory" ADD COLUMN IF NOT EXISTS "includesMonthlyBox" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeBox" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeBoxShipment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "status" "FotofficeBoxShipmentStatus" NOT NULL DEFAULT 'ENVIADA',
    "address" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "carrier" TEXT,
    "trackingCode" TEXT,
    "shippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "shippedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeBoxShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeBox_workspaceId_isActive_idx" ON "FotofficeBox"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeBox_workspaceId_number_key" ON "FotofficeBox"("workspaceId", "number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeBoxShipment_workspaceId_shippedAt_idx" ON "FotofficeBoxShipment"("workspaceId", "shippedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeBoxShipment_workspaceId_memberId_idx" ON "FotofficeBoxShipment"("workspaceId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeBoxShipment_memberId_boxId_key" ON "FotofficeBoxShipment"("memberId", "boxId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeBoxShipment" ADD CONSTRAINT "FotofficeBoxShipment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeBoxShipment" ADD CONSTRAINT "FotofficeBoxShipment_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "FotofficeBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
