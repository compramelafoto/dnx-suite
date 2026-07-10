-- CLF organizer commission ledger + direct MP collector states
-- Staging Neon never received the base enums/tables (schema drift / missing prior migration).
-- This migration is additive and idempotent:
--   1) create enums/tables if missing (full current schema values)
--   2) ADD VALUE IF NOT EXISTS for direct-collector states (safe if already present)

-- ---------------------------------------------------------------------------
-- Enums (create if missing)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "EventOrganizerCommissionStatus" AS ENUM (
    'PENDING',
    'AVAILABLE',
    'WITHDRAWAL_REQUESTED',
    'PAID',
    'PAID_DIRECT_TO_ORGANIZER',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventOrganizerCommissionPayoutMode" AS ENUM (
    'HELD_BY_PLATFORM',
    'MARKETPLACE_SPLIT',
    'ORGANIZER_AS_COLLECTOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizerCommissionWithdrawalStatus" AS ENUM (
    'REQUESTED',
    'APPROVED',
    'PAID',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- If enums already existed without the newer labels, add them safely.
ALTER TYPE "EventOrganizerCommissionStatus" ADD VALUE IF NOT EXISTS 'PAID_DIRECT_TO_ORGANIZER';
ALTER TYPE "EventOrganizerCommissionPayoutMode" ADD VALUE IF NOT EXISTS 'ORGANIZER_AS_COLLECTOR';

-- ---------------------------------------------------------------------------
-- Tables (create if missing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizerCommissionWithdrawalRequest" (
    "id" SERIAL NOT NULL,
    "organizerUserId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "OrganizerCommissionWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "adminNotes" TEXT,
    "paymentReference" TEXT,
    "payoutAliasSnapshot" TEXT,
    "payoutBankSnapshot" TEXT,
    "payoutAccountHolderSnapshot" TEXT,
    "payoutReceiptUrl" TEXT,
    "payoutReceiptFileName" TEXT,
    "payoutReceiptMimeType" TEXT,
    "payoutReceiptUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerCommissionWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventOrganizerCommission" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "organizerUserId" INTEGER NOT NULL,
    "photographerUserId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "organizerCommissionPercentage" DOUBLE PRECISION NOT NULL,
    "photographerBaseAmount" DECIMAL(14,2) NOT NULL,
    "platformFeeAmount" DECIMAL(14,2) NOT NULL,
    "organizerCommissionAmount" DECIMAL(14,2) NOT NULL,
    "photographerNetAmount" DECIMAL(14,2) NOT NULL,
    "totalPaidAmount" DECIMAL(14,2) NOT NULL,
    "status" "EventOrganizerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "payoutMode" "EventOrganizerCommissionPayoutMode" NOT NULL DEFAULT 'HELD_BY_PLATFORM',
    "withdrawalRequestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOrganizerCommission_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes / uniques (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "EventOrganizerCommission_orderId_key"
  ON "EventOrganizerCommission"("orderId");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_eventId_idx"
  ON "EventOrganizerCommission"("eventId");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_organizerUserId_idx"
  ON "EventOrganizerCommission"("organizerUserId");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_photographerUserId_idx"
  ON "EventOrganizerCommission"("photographerUserId");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_status_idx"
  ON "EventOrganizerCommission"("status");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_availableAt_idx"
  ON "EventOrganizerCommission"("availableAt");

CREATE INDEX IF NOT EXISTS "EventOrganizerCommission_withdrawalRequestId_idx"
  ON "EventOrganizerCommission"("withdrawalRequestId");

CREATE INDEX IF NOT EXISTS "OrganizerCommissionWithdrawalRequest_organizerUserId_idx"
  ON "OrganizerCommissionWithdrawalRequest"("organizerUserId");

CREATE INDEX IF NOT EXISTS "OrganizerCommissionWithdrawalRequest_status_idx"
  ON "OrganizerCommissionWithdrawalRequest"("status");

CREATE INDEX IF NOT EXISTS "OrganizerCommissionWithdrawalRequest_requestedAt_idx"
  ON "OrganizerCommissionWithdrawalRequest"("requestedAt");

-- ---------------------------------------------------------------------------
-- Foreign keys (add only if missing)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "OrganizerCommissionWithdrawalRequest"
    ADD CONSTRAINT "OrganizerCommissionWithdrawalRequest_organizerUserId_fkey"
    FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerCommissionWithdrawalRequest"
    ADD CONSTRAINT "OrganizerCommissionWithdrawalRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_organizerUserId_fkey"
    FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_photographerUserId_fkey"
    FOREIGN KEY ("photographerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventOrganizerCommission"
    ADD CONSTRAINT "EventOrganizerCommission_withdrawalRequestId_fkey"
    FOREIGN KEY ("withdrawalRequestId") REFERENCES "OrganizerCommissionWithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
