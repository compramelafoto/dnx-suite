-- Clickatón 10D2 — registrations, credentials, QR, check-in, kit, holds
-- Additive only. Hand-extracted from migrate diff (Clickaton* objects only).
-- Does NOT include unrelated schema drift.
-- Partial unique indexes appended manually for active check-in / active QR.

-- CreateEnum
CREATE TYPE "ClickatonRegistrationStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'REFUNDED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "ClickatonPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'APPROVED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ClickatonHoldStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ClickatonCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ClickatonQrTokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ClickatonKitDeliveryStatus" AS ENUM ('PENDING', 'PARTIAL', 'DELIVERED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ClickatonCheckInSource" AS ENUM ('QR_SCAN', 'MANUAL_SEARCH', 'ADMIN');

-- AlterTable
ALTER TABLE "ClickatonEdition" ADD COLUMN     "visibleCodePrefix" TEXT;

-- CreateTable
CREATE TABLE "ClickatonEditionSequence" (
    "editionId" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonEditionSequence_pkey" PRIMARY KEY ("editionId")
);

-- CreateTable
CREATE TABLE "ClickatonTicketType" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "venueId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "capacity" INTEGER,
    "holdMinutes" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonTicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonProduct" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "priceAmount" INTEGER,
    "currency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonTicketTypeItem" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requiresVariantChoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonTicketTypeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonRegistration" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "venueId" TEXT,
    "userId" INTEGER NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "status" "ClickatonRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "ClickatonPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "visibleCode" TEXT,
    "sequenceNumber" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "documentNumber" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'AR',
    "birthDate" TIMESTAMP(3),
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "acceptedTermsAt" TIMESTAMP(3),
    "acceptedImageAt" TIMESTAMP(3),
    "parentalConsentAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "holdExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "paymentOrderId" TEXT,
    "paymentProvider" TEXT,
    "paymentExternalReference" TEXT,
    "paymentIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonRegistrationItem" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "productId" TEXT,
    "productVariantId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceAmount" INTEGER NOT NULL DEFAULT 0,
    "totalPriceAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isIncluded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonRegistrationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonCapacityHold" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "venueId" TEXT,
    "ticketTypeId" TEXT NOT NULL,
    "status" "ClickatonHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonCapacityHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonStockHold" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ClickatonHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonStockHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonParticipantCredential" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "status" "ClickatonCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "publicCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonParticipantCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonQrToken" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT,
    "status" "ClickatonQrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonCheckIn" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "venueId" TEXT,
    "operatorUserId" INTEGER NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" INTEGER,
    "reversalReason" TEXT,
    "source" "ClickatonCheckInSource" NOT NULL DEFAULT 'QR_SCAN',
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonKitDelivery" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "venueId" TEXT,
    "operatorUserId" INTEGER NOT NULL,
    "status" "ClickatonKitDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" INTEGER,
    "notes" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonKitDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonKitDeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "registrationItemId" TEXT NOT NULL,
    "quantityDelivered" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonKitDeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonRegistrationStatusHistory" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "previousStatus" "ClickatonRegistrationStatus",
    "newStatus" "ClickatonRegistrationStatus" NOT NULL,
    "previousPaymentStatus" "ClickatonPaymentStatus",
    "newPaymentStatus" "ClickatonPaymentStatus" NOT NULL,
    "actorUserId" INTEGER,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonRegistrationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickatonRegistrationAudit" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickatonRegistrationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClickatonTicketType_editionId_isActive_idx" ON "ClickatonTicketType"("editionId", "isActive");

-- CreateIndex
CREATE INDEX "ClickatonTicketType_venueId_idx" ON "ClickatonTicketType"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonTicketType_editionId_code_key" ON "ClickatonTicketType"("editionId", "code");

-- CreateIndex
CREATE INDEX "ClickatonProduct_editionId_isActive_idx" ON "ClickatonProduct"("editionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonProduct_editionId_code_key" ON "ClickatonProduct"("editionId", "code");

-- CreateIndex
CREATE INDEX "ClickatonProductVariant_productId_isActive_idx" ON "ClickatonProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonProductVariant_productId_code_key" ON "ClickatonProductVariant"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonProductVariant_sku_key" ON "ClickatonProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ClickatonTicketTypeItem_ticketTypeId_idx" ON "ClickatonTicketTypeItem"("ticketTypeId");

-- CreateIndex
CREATE INDEX "ClickatonTicketTypeItem_productId_idx" ON "ClickatonTicketTypeItem"("productId");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_editionId_status_idx" ON "ClickatonRegistration"("editionId", "status");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_editionId_paymentStatus_idx" ON "ClickatonRegistration"("editionId", "paymentStatus");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_userId_idx" ON "ClickatonRegistration"("userId");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_email_idx" ON "ClickatonRegistration"("email");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_venueId_idx" ON "ClickatonRegistration"("venueId");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_ticketTypeId_idx" ON "ClickatonRegistration"("ticketTypeId");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_holdExpiresAt_idx" ON "ClickatonRegistration"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_paymentOrderId_idx" ON "ClickatonRegistration"("paymentOrderId");

-- CreateIndex
CREATE INDEX "ClickatonRegistration_paymentIdempotencyKey_idx" ON "ClickatonRegistration"("paymentIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonRegistration_editionId_visibleCode_key" ON "ClickatonRegistration"("editionId", "visibleCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonRegistration_editionId_sequenceNumber_key" ON "ClickatonRegistration"("editionId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationItem_registrationId_idx" ON "ClickatonRegistrationItem"("registrationId");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationItem_productVariantId_idx" ON "ClickatonRegistrationItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonCapacityHold_registrationId_key" ON "ClickatonCapacityHold"("registrationId");

-- CreateIndex
CREATE INDEX "ClickatonCapacityHold_status_expiresAt_idx" ON "ClickatonCapacityHold"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ClickatonCapacityHold_editionId_status_idx" ON "ClickatonCapacityHold"("editionId", "status");

-- CreateIndex
CREATE INDEX "ClickatonCapacityHold_ticketTypeId_status_idx" ON "ClickatonCapacityHold"("ticketTypeId", "status");

-- CreateIndex
CREATE INDEX "ClickatonStockHold_registrationId_status_idx" ON "ClickatonStockHold"("registrationId", "status");

-- CreateIndex
CREATE INDEX "ClickatonStockHold_productVariantId_status_idx" ON "ClickatonStockHold"("productVariantId", "status");

-- CreateIndex
CREATE INDEX "ClickatonStockHold_status_expiresAt_idx" ON "ClickatonStockHold"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonParticipantCredential_registrationId_key" ON "ClickatonParticipantCredential"("registrationId");

-- CreateIndex
CREATE INDEX "ClickatonParticipantCredential_status_idx" ON "ClickatonParticipantCredential"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonParticipantCredential_publicCode_key" ON "ClickatonParticipantCredential"("publicCode");

-- CreateIndex
CREATE INDEX "ClickatonQrToken_credentialId_status_idx" ON "ClickatonQrToken"("credentialId", "status");

-- CreateIndex
CREATE INDEX "ClickatonQrToken_tokenPrefix_idx" ON "ClickatonQrToken"("tokenPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "ClickatonQrToken_tokenHash_key" ON "ClickatonQrToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_registrationId_idx" ON "ClickatonCheckIn"("registrationId");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_credentialId_idx" ON "ClickatonCheckIn"("credentialId");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_venueId_idx" ON "ClickatonCheckIn"("venueId");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_operatorUserId_idx" ON "ClickatonCheckIn"("operatorUserId");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_checkedInAt_idx" ON "ClickatonCheckIn"("checkedInAt");

-- CreateIndex
CREATE INDEX "ClickatonCheckIn_requestId_idx" ON "ClickatonCheckIn"("requestId");

-- CreateIndex
CREATE INDEX "ClickatonKitDelivery_registrationId_status_idx" ON "ClickatonKitDelivery"("registrationId", "status");

-- CreateIndex
CREATE INDEX "ClickatonKitDelivery_venueId_idx" ON "ClickatonKitDelivery"("venueId");

-- CreateIndex
CREATE INDEX "ClickatonKitDelivery_operatorUserId_idx" ON "ClickatonKitDelivery"("operatorUserId");

-- CreateIndex
CREATE INDEX "ClickatonKitDelivery_requestId_idx" ON "ClickatonKitDelivery"("requestId");

-- CreateIndex
CREATE INDEX "ClickatonKitDeliveryItem_deliveryId_idx" ON "ClickatonKitDeliveryItem"("deliveryId");

-- CreateIndex
CREATE INDEX "ClickatonKitDeliveryItem_registrationItemId_idx" ON "ClickatonKitDeliveryItem"("registrationItemId");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationStatusHistory_registrationId_createdAt_idx" ON "ClickatonRegistrationStatusHistory"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationStatusHistory_actorUserId_idx" ON "ClickatonRegistrationStatusHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationStatusHistory_requestId_idx" ON "ClickatonRegistrationStatusHistory"("requestId");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationAudit_registrationId_createdAt_idx" ON "ClickatonRegistrationAudit"("registrationId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationAudit_actorUserId_idx" ON "ClickatonRegistrationAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationAudit_action_idx" ON "ClickatonRegistrationAudit"("action");

-- CreateIndex
CREATE INDEX "ClickatonRegistrationAudit_requestId_idx" ON "ClickatonRegistrationAudit"("requestId");

-- AddForeignKey
ALTER TABLE "ClickatonEditionSequence" ADD CONSTRAINT "ClickatonEditionSequence_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonTicketType" ADD CONSTRAINT "ClickatonTicketType_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonTicketType" ADD CONSTRAINT "ClickatonTicketType_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ClickatonVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonProduct" ADD CONSTRAINT "ClickatonProduct_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonProductVariant" ADD CONSTRAINT "ClickatonProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ClickatonProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonTicketTypeItem" ADD CONSTRAINT "ClickatonTicketTypeItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ClickatonTicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonTicketTypeItem" ADD CONSTRAINT "ClickatonTicketTypeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ClickatonProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonTicketTypeItem" ADD CONSTRAINT "ClickatonTicketTypeItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ClickatonProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistration" ADD CONSTRAINT "ClickatonRegistration_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistration" ADD CONSTRAINT "ClickatonRegistration_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ClickatonVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistration" ADD CONSTRAINT "ClickatonRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistration" ADD CONSTRAINT "ClickatonRegistration_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ClickatonTicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationItem" ADD CONSTRAINT "ClickatonRegistrationItem_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationItem" ADD CONSTRAINT "ClickatonRegistrationItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ClickatonProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCapacityHold" ADD CONSTRAINT "ClickatonCapacityHold_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCapacityHold" ADD CONSTRAINT "ClickatonCapacityHold_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCapacityHold" ADD CONSTRAINT "ClickatonCapacityHold_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ClickatonVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCapacityHold" ADD CONSTRAINT "ClickatonCapacityHold_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "ClickatonTicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonStockHold" ADD CONSTRAINT "ClickatonStockHold_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonStockHold" ADD CONSTRAINT "ClickatonStockHold_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ClickatonProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonParticipantCredential" ADD CONSTRAINT "ClickatonParticipantCredential_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonParticipantCredential" ADD CONSTRAINT "ClickatonParticipantCredential_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "ClickatonParticipantCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonQrToken" ADD CONSTRAINT "ClickatonQrToken_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ClickatonParticipantCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCheckIn" ADD CONSTRAINT "ClickatonCheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCheckIn" ADD CONSTRAINT "ClickatonCheckIn_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "ClickatonParticipantCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCheckIn" ADD CONSTRAINT "ClickatonCheckIn_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ClickatonVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCheckIn" ADD CONSTRAINT "ClickatonCheckIn_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonCheckIn" ADD CONSTRAINT "ClickatonCheckIn_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDelivery" ADD CONSTRAINT "ClickatonKitDelivery_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDelivery" ADD CONSTRAINT "ClickatonKitDelivery_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ClickatonVenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDelivery" ADD CONSTRAINT "ClickatonKitDelivery_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDelivery" ADD CONSTRAINT "ClickatonKitDelivery_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDeliveryItem" ADD CONSTRAINT "ClickatonKitDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClickatonKitDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonKitDeliveryItem" ADD CONSTRAINT "ClickatonKitDeliveryItem_registrationItemId_fkey" FOREIGN KEY ("registrationItemId") REFERENCES "ClickatonRegistrationItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationStatusHistory" ADD CONSTRAINT "ClickatonRegistrationStatusHistory_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationStatusHistory" ADD CONSTRAINT "ClickatonRegistrationStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationAudit" ADD CONSTRAINT "ClickatonRegistrationAudit_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ClickatonRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickatonRegistrationAudit" ADD CONSTRAINT "ClickatonRegistrationAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Partial unique: at most one active (non-reversed) check-in per registration
CREATE UNIQUE INDEX "ClickatonCheckIn_registrationId_active_key"
ON "ClickatonCheckIn" ("registrationId")
WHERE "reversedAt" IS NULL;

-- Partial unique: at most one ACTIVE QR token per credential
CREATE UNIQUE INDEX "ClickatonQrToken_credentialId_active_key"
ON "ClickatonQrToken" ("credentialId")
WHERE "status" = 'ACTIVE';

-- Partial unique: at most one non-reversed kit delivery "primary" open/delivered per registration
-- (allow history of REVERSED rows)
CREATE UNIQUE INDEX "ClickatonKitDelivery_registrationId_active_key"
ON "ClickatonKitDelivery" ("registrationId")
WHERE "reversedAt" IS NULL AND "status" <> 'REVERSED';
