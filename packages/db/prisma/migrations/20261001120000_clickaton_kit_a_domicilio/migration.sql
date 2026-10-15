-- Envío del kit de Clickatón a domicilio: configuración por edición, domicilio y
-- seguimiento por inscripción, y una fuente de acreditación nueva para quien
-- confirma con el QR del instructivo que le llegó el kit.
-- Sólo agrega; no toca datos existentes. Se puede correr más de una vez.

ALTER TYPE "ClickatonCheckInSource" ADD VALUE IF NOT EXISTS 'KIT_SELF_CONFIRM';

DO $$ BEGIN
    CREATE TYPE "ClickatonHomeDeliveryStatus" AS ENUM ('PENDING', 'DISPATCHED', 'RECEIVED', 'RETURNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ClickatonEditionHomeDelivery" (
    "editionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "feeAmount" INTEGER NOT NULL,
    "guaranteedUntil" TIMESTAMP(3),
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonEditionHomeDelivery_pkey" PRIMARY KEY ("editionId")
);

CREATE TABLE IF NOT EXISTS "ClickatonRegistrationShipping" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "guaranteed" BOOLEAN NOT NULL,
    "recipientName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "streetNumber" TEXT NOT NULL,
    "floor" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "reference" TEXT,
    "status" "ClickatonHomeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedByUserId" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClickatonRegistrationShipping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonRegistrationShipping_registrationId_key" ON "ClickatonRegistrationShipping"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonRegistrationShipping_editionId_status_idx" ON "ClickatonRegistrationShipping"("editionId", "status");

DO $$ BEGIN
    ALTER TABLE "ClickatonEditionHomeDelivery" ADD CONSTRAINT "ClickatonEditionHomeDelivery_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ClickatonRegistrationShipping" ADD CONSTRAINT "ClickatonRegistrationShipping_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ClickatonRegistrationShipping" ADD CONSTRAINT "ClickatonRegistrationShipping_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
