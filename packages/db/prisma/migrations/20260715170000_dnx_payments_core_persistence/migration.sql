-- DNX Payments core persistence (Etapa 04).
-- Additive only: CREATE TYPE / TABLE / INDEX / CONSTRAINT.
-- No DROP, TRUNCATE, DELETE, or CLF table mutations.
-- Do not apply to Production in this stage without explicit authorization.

-- Enums
CREATE TYPE "DnxPaymentRecipientType" AS ENUM (
  'PLATFORM',
  'PHOTOGRAPHER',
  'ORGANIZER',
  'LAB',
  'INFOSPOT_EDITOR',
  'REFERRAL',
  'AMBASSADOR',
  'DELEGATE',
  'SPONSOR',
  'AFFILIATE',
  'OTHER'
);

CREATE TYPE "DnxPaymentRecipientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TYPE "DnxPaymentProvider" AS ENUM (
  'MERCADOPAGO',
  'MERCADOPAGO_PREFERENCES_LEGACY',
  'STRIPE',
  'PAYPAL',
  'TRANSFER',
  'MANUAL',
  'OTHER'
);

CREATE TYPE "DnxPaymentEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

CREATE TYPE "DnxProviderRecipientAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'REVOKED');

CREATE TYPE "DnxSplitConsentStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELED', 'EXPIRED');

CREATE TYPE "DnxSplitConsentSource" AS ENUM ('SMOKE', 'MCP', 'APPLICATION', 'MANUAL', 'IMPORT');

CREATE TYPE "DnxPaymentIntentStatus" AS ENUM (
  'DRAFT',
  'READY',
  'SUBMITTED',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
  'EXPIRED'
);

CREATE TYPE "DnxPaymentOrderStatus" AS ENUM (
  'CREATED',
  'AWAITING_PROVIDER',
  'AUTHORIZED',
  'CAPTURED',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'CHARGED_BACK',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "DnxProviderOrderMappedStatus" AS ENUM (
  'PENDING',
  'OPEN',
  'PROCESSED',
  'REFUNDED',
  'CHARGED_BACK',
  'FAILED',
  'CANCELED',
  'UNKNOWN'
);

CREATE TYPE "DnxProviderSplitReceiverType" AS ENUM ('OWNER', 'PARTNER');

CREATE TYPE "DnxProviderSplitStatus" AS ENUM ('PLANNED', 'SUBMITTED', 'CONFIRMED', 'FAILED');

CREATE TYPE "DnxPaymentIdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED', 'CONFLICT');

CREATE TYPE "DnxPaymentWebhookProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED',
  'DEAD_LETTER'
);

CREATE TYPE "DnxPaymentAuditActorType" AS ENUM ('SYSTEM', 'USER', 'PROVIDER', 'OPS');

CREATE TYPE "DnxPaymentAuditResult" AS ENUM ('SUCCEEDED', 'FAILED', 'DENIED', 'SKIPPED');

-- Tables
CREATE TABLE "DnxPaymentRecipient" (
  "id" TEXT NOT NULL,
  "userId" INTEGER,
  "recipientType" "DnxPaymentRecipientType" NOT NULL,
  "status" "DnxPaymentRecipientStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPaymentRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxProviderRecipientAccount" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "providerAccountReference" TEXT NOT NULL,
  "providerOwnerEligible" BOOLEAN NOT NULL DEFAULT false,
  "status" "DnxProviderRecipientAccountStatus" NOT NULL DEFAULT 'PENDING',
  "metadataSanitized" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxProviderRecipientAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxSplitConsent" (
  "id" TEXT NOT NULL,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "primaryProviderAccountReference" TEXT NOT NULL,
  "providerReceiverId" TEXT,
  "recipientId" TEXT,
  "status" "DnxSplitConsentStatus" NOT NULL DEFAULT 'PENDING',
  "invitationReference" TEXT,
  "providerCreatedAt" TIMESTAMP(3),
  "providerUpdatedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "source" "DnxSplitConsentSource" NOT NULL DEFAULT 'APPLICATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxSplitConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentIntent" (
  "id" TEXT NOT NULL,
  "sourceProduct" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "totalMinor" BIGINT NOT NULL,
  "status" "DnxPaymentIntentStatus" NOT NULL DEFAULT 'DRAFT',
  "distributionSnapshot" JSONB,
  "providerPreference" TEXT,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "isTestFixture" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentIdempotencyRecord" (
  "id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "aggregateType" TEXT,
  "aggregateId" TEXT,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "DnxPaymentIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "providerReference" TEXT,
  "responseHash" TEXT,
  "lockedAt" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPaymentIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentOrder" (
  "id" TEXT NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "status" "DnxPaymentOrderStatus" NOT NULL DEFAULT 'CREATED',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "ownerRecipientId" TEXT NOT NULL,
  "distributionSnapshot" JSONB,
  "idempotencyRecordId" TEXT,
  "isTestFixture" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxProviderOrder" (
  "id" TEXT NOT NULL,
  "paymentOrderId" TEXT NOT NULL,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "providerOrderId" TEXT NOT NULL,
  "providerStatus" TEXT,
  "providerStatusDetail" TEXT,
  "mappedStatus" "DnxProviderOrderMappedStatus" NOT NULL DEFAULT 'PENDING',
  "totalMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "rawResponseSanitized" JSONB,
  "lastFetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxProviderOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxProviderSplit" (
  "id" TEXT NOT NULL,
  "providerOrderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "providerReceiverReference" TEXT NOT NULL,
  "receiverType" "DnxProviderSplitReceiverType" NOT NULL,
  "amountMinor" BIGINT,
  "percentageBps" INTEGER,
  "currency" TEXT NOT NULL,
  "description" TEXT,
  "status" "DnxProviderSplitStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxProviderSplit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentWebhookInbox" (
  "id" TEXT NOT NULL,
  "provider" "DnxPaymentProvider" NOT NULL,
  "environment" "DnxPaymentEnvironment" NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerEventId" TEXT,
  "providerResourceId" TEXT,
  "headersHash" TEXT,
  "rawBodyHash" TEXT NOT NULL,
  "payloadSanitized" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStatus" "DnxPaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "errorCodeSanitized" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DnxPaymentWebhookInbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DnxPaymentAuditEvent" (
  "id" TEXT NOT NULL,
  "actorType" "DnxPaymentAuditActorType" NOT NULL,
  "actorReference" TEXT,
  "action" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "provider" "DnxPaymentProvider",
  "environment" "DnxPaymentEnvironment",
  "correlationId" TEXT,
  "result" "DnxPaymentAuditResult" NOT NULL,
  "errorCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DnxPaymentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "DnxProviderRecipientAccount_recipientId_provider_environment_providerAccountReference_key"
  ON "DnxProviderRecipientAccount"("recipientId", "provider", "environment", "providerAccountReference");

CREATE UNIQUE INDEX "DnxSplitConsent_provider_environment_providerReceiverId_key"
  ON "DnxSplitConsent"("provider", "environment", "providerReceiverId");

CREATE UNIQUE INDEX "DnxPaymentIntent_sourceProduct_externalReference_key"
  ON "DnxPaymentIntent"("sourceProduct", "externalReference");

CREATE UNIQUE INDEX "DnxPaymentOrder_idempotencyRecordId_key"
  ON "DnxPaymentOrder"("idempotencyRecordId");

CREATE UNIQUE INDEX "DnxProviderOrder_provider_environment_providerOrderId_key"
  ON "DnxProviderOrder"("provider", "environment", "providerOrderId");

CREATE UNIQUE INDEX "DnxProviderSplit_providerOrderId_receiverType_providerReceiverReference_key"
  ON "DnxProviderSplit"("providerOrderId", "receiverType", "providerReceiverReference");

CREATE UNIQUE INDEX "DnxPaymentIdempotencyRecord_provider_environment_idempotencyKey_key"
  ON "DnxPaymentIdempotencyRecord"("provider", "environment", "idempotencyKey");

CREATE UNIQUE INDEX "DnxPaymentWebhookInbox_provider_environment_providerEventId_providerResourceId_key"
  ON "DnxPaymentWebhookInbox"("provider", "environment", "providerEventId", "providerResourceId");

-- Indexes
CREATE INDEX "DnxPaymentRecipient_userId_idx" ON "DnxPaymentRecipient"("userId");
CREATE INDEX "DnxPaymentRecipient_recipientType_status_idx" ON "DnxPaymentRecipient"("recipientType", "status");

CREATE INDEX "DnxProviderRecipientAccount_provider_environment_providerAccountReference_idx"
  ON "DnxProviderRecipientAccount"("provider", "environment", "providerAccountReference");
CREATE INDEX "DnxProviderRecipientAccount_recipientId_idx" ON "DnxProviderRecipientAccount"("recipientId");

CREATE INDEX "DnxSplitConsent_provider_environment_status_idx" ON "DnxSplitConsent"("provider", "environment", "status");
CREATE INDEX "DnxSplitConsent_recipientId_idx" ON "DnxSplitConsent"("recipientId");
CREATE INDEX "DnxSplitConsent_primaryProviderAccountReference_environment_idx"
  ON "DnxSplitConsent"("primaryProviderAccountReference", "environment");

CREATE INDEX "DnxPaymentIntent_status_idx" ON "DnxPaymentIntent"("status");
CREATE INDEX "DnxPaymentIntent_environment_isTestFixture_idx" ON "DnxPaymentIntent"("environment", "isTestFixture");

CREATE INDEX "DnxPaymentOrder_paymentIntentId_idx" ON "DnxPaymentOrder"("paymentIntentId");
CREATE INDEX "DnxPaymentOrder_provider_environment_status_idx" ON "DnxPaymentOrder"("provider", "environment", "status");
CREATE INDEX "DnxPaymentOrder_ownerRecipientId_idx" ON "DnxPaymentOrder"("ownerRecipientId");

CREATE INDEX "DnxProviderOrder_paymentOrderId_idx" ON "DnxProviderOrder"("paymentOrderId");
CREATE INDEX "DnxProviderOrder_mappedStatus_idx" ON "DnxProviderOrder"("mappedStatus");

CREATE INDEX "DnxProviderSplit_providerOrderId_idx" ON "DnxProviderSplit"("providerOrderId");
CREATE INDEX "DnxProviderSplit_recipientId_idx" ON "DnxProviderSplit"("recipientId");

CREATE INDEX "DnxPaymentIdempotencyRecord_status_idx" ON "DnxPaymentIdempotencyRecord"("status");
CREATE INDEX "DnxPaymentIdempotencyRecord_aggregateType_aggregateId_idx"
  ON "DnxPaymentIdempotencyRecord"("aggregateType", "aggregateId");

CREATE INDEX "DnxPaymentWebhookInbox_processingStatus_receivedAt_idx"
  ON "DnxPaymentWebhookInbox"("processingStatus", "receivedAt");
CREATE INDEX "DnxPaymentWebhookInbox_provider_environment_eventType_idx"
  ON "DnxPaymentWebhookInbox"("provider", "environment", "eventType");

CREATE INDEX "DnxPaymentAuditEvent_aggregateType_aggregateId_idx"
  ON "DnxPaymentAuditEvent"("aggregateType", "aggregateId");
CREATE INDEX "DnxPaymentAuditEvent_correlationId_idx" ON "DnxPaymentAuditEvent"("correlationId");
CREATE INDEX "DnxPaymentAuditEvent_provider_environment_createdAt_idx"
  ON "DnxPaymentAuditEvent"("provider", "environment", "createdAt");
CREATE INDEX "DnxPaymentAuditEvent_action_createdAt_idx" ON "DnxPaymentAuditEvent"("action", "createdAt");

-- Foreign keys
ALTER TABLE "DnxPaymentRecipient"
  ADD CONSTRAINT "DnxPaymentRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxProviderRecipientAccount"
  ADD CONSTRAINT "DnxProviderRecipientAccount_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "DnxPaymentRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxSplitConsent"
  ADD CONSTRAINT "DnxSplitConsent_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "DnxPaymentRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxPaymentOrder"
  ADD CONSTRAINT "DnxPaymentOrder_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "DnxPaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxPaymentOrder"
  ADD CONSTRAINT "DnxPaymentOrder_ownerRecipientId_fkey"
  FOREIGN KEY ("ownerRecipientId") REFERENCES "DnxPaymentRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxPaymentOrder"
  ADD CONSTRAINT "DnxPaymentOrder_idempotencyRecordId_fkey"
  FOREIGN KEY ("idempotencyRecordId") REFERENCES "DnxPaymentIdempotencyRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DnxProviderOrder"
  ADD CONSTRAINT "DnxProviderOrder_paymentOrderId_fkey"
  FOREIGN KEY ("paymentOrderId") REFERENCES "DnxPaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxProviderSplit"
  ADD CONSTRAINT "DnxProviderSplit_providerOrderId_fkey"
  FOREIGN KEY ("providerOrderId") REFERENCES "DnxProviderOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DnxProviderSplit"
  ADD CONSTRAINT "DnxProviderSplit_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "DnxPaymentRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
