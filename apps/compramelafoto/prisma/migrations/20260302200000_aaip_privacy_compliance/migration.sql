-- Add marketing audit fields to User (AAIP compliance)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptInIp" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptInSource" TEXT;

-- Add face consent for User (AAIP facial recognition compliance)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "faceConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "faceConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "faceConsentIp" TEXT;

-- Create PrivacyRequest model for ARCO requests
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESO', 'RECTIFICACION', 'SUPRESION', 'OCULTAR_FOTO', 'BAJA_MARKETING', 'DESACTIVAR_BIOMETRIA');
CREATE TYPE "PrivacyRequestRelationship" AS ENUM ('TITULAR', 'PADRE_MADRE_TUTOR');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "PrivacyRequest" (
    "id" SERIAL NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "relationship" "PrivacyRequestRelationship" NOT NULL DEFAULT 'TITULAR',
    "description" TEXT,
    "albumId" INTEGER,
    "photoId" INTEGER,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "internalNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_type_idx" ON "PrivacyRequest"("type");
CREATE INDEX IF NOT EXISTS "PrivacyRequest_createdAt_idx" ON "PrivacyRequest"("createdAt");

-- Create PrivacyEvent for audit (face consent, etc.)
CREATE TABLE IF NOT EXISTS "PrivacyEvent" (
    "id" SERIAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrivacyEvent_eventType_idx" ON "PrivacyEvent"("eventType");
CREATE INDEX IF NOT EXISTS "PrivacyEvent_userId_idx" ON "PrivacyEvent"("userId");
CREATE INDEX IF NOT EXISTS "PrivacyEvent_createdAt_idx" ON "PrivacyEvent"("createdAt");
