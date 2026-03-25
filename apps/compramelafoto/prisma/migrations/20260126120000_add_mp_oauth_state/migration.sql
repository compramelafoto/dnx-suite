-- CreateEnum (idempotent: el baseline ya puede haberlo creado)
DO $$ BEGIN
  CREATE TYPE "MercadoPagoOwnerType" AS ENUM ('USER', 'LAB');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent: ignorar si las columnas ya existen)
DO $$ BEGIN ALTER TABLE "Order" ADD COLUMN "mpPreferenceId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Order" ADD COLUMN "mpInitPoint" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Order" ADD COLUMN "mpPaymentId" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "MercadoPagoOAuthState" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "ownerType" "MercadoPagoOwnerType" NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MercadoPagoOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent: no fallar si ya existen)
CREATE UNIQUE INDEX IF NOT EXISTS "MercadoPagoOAuthState_state_key" ON "MercadoPagoOAuthState"("state");
CREATE INDEX IF NOT EXISTS "MercadoPagoOAuthState_ownerType_ownerId_idx" ON "MercadoPagoOAuthState"("ownerType", "ownerId");
CREATE INDEX IF NOT EXISTS "MercadoPagoOAuthState_expiresAt_idx" ON "MercadoPagoOAuthState"("expiresAt");
