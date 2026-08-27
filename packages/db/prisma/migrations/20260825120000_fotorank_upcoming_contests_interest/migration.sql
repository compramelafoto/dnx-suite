-- FotoRank — concursos próximos ("PRÓXIMAMENTE" / "Notificarme").
-- Migración ADITIVA. No renombra, no elimina, no modifica filas existentes.
-- Ningún concurso preexistente cambia de estado: los valores nuevos del enum
-- solo se asignan explícitamente desde la administración o el seed.

-- ---------------------------------------------------------------------------
-- 1. Ciclo de vida extendido del concurso (aditivo sobre el enum existente).
--    ALTER TYPE ... ADD VALUE no reescribe filas ni invalida índices.
--    IF NOT EXISTS hace la migración reejecutable.
-- ---------------------------------------------------------------------------
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'UPCOMING';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'REGISTRATION_OPEN';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'SUBMISSIONS_CLOSED';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'ADMISSION';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'JUDGING';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'FINALISTS';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "FotorankContestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ---------------------------------------------------------------------------
-- 2. Enums propios de la capacidad.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FotorankContestInterestStatus') THEN
    CREATE TYPE "FotorankContestInterestStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'CONVERTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FotorankContestPriceAudience') THEN
    CREATE TYPE "FotorankContestPriceAudience" AS ENUM ('INTEREST_EXCLUSIVE', 'GENERAL');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Registro de interés ("Notificarme").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FotorankContestInterest" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "FotorankContestInterestStatus" NOT NULL DEFAULT 'ACTIVE',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "benefitDeadlineAt" TIMESTAMP(3),
    "benefitEligible" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'PUBLIC_CARD',
    "consentVersion" TEXT NOT NULL,
    "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
    "contestSpecificOptIn" BOOLEAN NOT NULL DEFAULT true,
    "generalOptIn" BOOLEAN NOT NULL DEFAULT false,
    "generalOptInAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedRegistrationId" TEXT,
    "selectedPackageCode" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestInterest_pkey" PRIMARY KEY ("id")
);

-- Idempotencia de "Notificarme": un registro por concurso y usuario.
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestInterest_contestId_userId_key"
    ON "FotorankContestInterest"("contestId", "userId");
CREATE INDEX IF NOT EXISTS "FotorankContestInterest_contestId_status_idx"
    ON "FotorankContestInterest"("contestId", "status");
CREATE INDEX IF NOT EXISTS "FotorankContestInterest_contestId_benefitEligible_idx"
    ON "FotorankContestInterest"("contestId", "benefitEligible");
CREATE INDEX IF NOT EXISTS "FotorankContestInterest_userId_idx"
    ON "FotorankContestInterest"("userId");

-- ---------------------------------------------------------------------------
-- 4. Auditoría append-only del interés.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FotorankContestInterestAuditEvent" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "interestId" TEXT,
    "actorUserId" INTEGER,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankContestInterestAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FotorankContestInterestAuditEvent_contestId_createdAt_idx"
    ON "FotorankContestInterestAuditEvent"("contestId", "createdAt");
CREATE INDEX IF NOT EXISTS "FotorankContestInterestAuditEvent_interestId_createdAt_idx"
    ON "FotorankContestInterestAuditEvent"("interestId", "createdAt");
CREATE INDEX IF NOT EXISTS "FotorankContestInterestAuditEvent_actorUserId_idx"
    ON "FotorankContestInterestAuditEvent"("actorUserId");

-- ---------------------------------------------------------------------------
-- 5. Fases de precio (configuración; sin checkout).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FotorankContestPricePhase" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" "FotorankContestPriceAudience" NOT NULL DEFAULT 'GENERAL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestPricePhase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestPricePhase_contestId_code_key"
    ON "FotorankContestPricePhase"("contestId", "code");
CREATE INDEX IF NOT EXISTS "FotorankContestPricePhase_contestId_isActive_idx"
    ON "FotorankContestPricePhase"("contestId", "isActive");
CREATE INDEX IF NOT EXISTS "FotorankContestPricePhase_contestId_startsAt_endsAt_idx"
    ON "FotorankContestPricePhase"("contestId", "startsAt", "endsAt");

CREATE TABLE IF NOT EXISTS "FotorankContestPriceTier" (
    "id" TEXT NOT NULL,
    "pricePhaseId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestPriceTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestPriceTier_pricePhaseId_quantity_key"
    ON "FotorankContestPriceTier"("pricePhaseId", "quantity");
CREATE INDEX IF NOT EXISTS "FotorankContestPriceTier_pricePhaseId_sortOrder_idx"
    ON "FotorankContestPriceTier"("pricePhaseId", "sortOrder");

-- ---------------------------------------------------------------------------
-- 6. Calendario de comunicaciones (declarativo; no dispara envíos).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "FotorankContestScheduledCommunication" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyOutline" TEXT,
    "scheduledLocal" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "isDateDriven" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'PROMOTIONAL',
    "audience" TEXT NOT NULL DEFAULT 'INTEREST_SPECIFIC',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestScheduledCommunication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestScheduledCommunication_contestId_code_key"
    ON "FotorankContestScheduledCommunication"("contestId", "code");
CREATE INDEX IF NOT EXISTS "FotorankContestScheduledCommunication_contestId_scheduledAt_idx"
    ON "FotorankContestScheduledCommunication"("contestId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "FotorankContestScheduledCommunication_contestId_isEnabled_idx"
    ON "FotorankContestScheduledCommunication"("contestId", "isEnabled");

-- ---------------------------------------------------------------------------
-- 7. Claves foráneas.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestInterest_contestId_fkey') THEN
    ALTER TABLE "FotorankContestInterest"
      ADD CONSTRAINT "FotorankContestInterest_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestInterest_userId_fkey') THEN
    ALTER TABLE "FotorankContestInterest"
      ADD CONSTRAINT "FotorankContestInterest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestInterestAuditEvent_contestId_fkey') THEN
    ALTER TABLE "FotorankContestInterestAuditEvent"
      ADD CONSTRAINT "FotorankContestInterestAuditEvent_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestInterestAuditEvent_actorUserId_fkey') THEN
    ALTER TABLE "FotorankContestInterestAuditEvent"
      ADD CONSTRAINT "FotorankContestInterestAuditEvent_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestPricePhase_contestId_fkey') THEN
    ALTER TABLE "FotorankContestPricePhase"
      ADD CONSTRAINT "FotorankContestPricePhase_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestPriceTier_pricePhaseId_fkey') THEN
    ALTER TABLE "FotorankContestPriceTier"
      ADD CONSTRAINT "FotorankContestPriceTier_pricePhaseId_fkey"
      FOREIGN KEY ("pricePhaseId") REFERENCES "FotorankContestPricePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestScheduledCommunication_contestId_fkey') THEN
    ALTER TABLE "FotorankContestScheduledCommunication"
      ADD CONSTRAINT "FotorankContestScheduledCommunication_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
