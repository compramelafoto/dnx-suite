-- Referidos de Clickatón — Etapa 01 (atribución).
-- Se aplica a mano en la base de Clickatón antes de publicar el código.
--
-- Sólo agrega tablas y un enum nuevos: no toca ninguna columna existente, así
-- que aplicarlo antes del deploy es seguro para el código que ya está vivo.

DO $$ BEGIN
  CREATE TYPE "ClickatonReferralAttributionStatus" AS ENUM (
    'EARNED', 'CONSUMED', 'REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Código del link de invitación (/i/<code>). Uno por usuario.
CREATE TABLE IF NOT EXISTS "ClickatonReferralCode" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonReferralCode_userId_key"
  ON "ClickatonReferralCode"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonReferralCode_code_key"
  ON "ClickatonReferralCode"("code");
CREATE INDEX IF NOT EXISTS "ClickatonReferralCode_code_idx"
  ON "ClickatonReferralCode"("code");

-- Puente entre la inscripción y la confirmación del pago: la cookie existe al
-- inscribirse, pero confirmPaid corre en el webhook, sin navegador.
--
-- Tabla propia y no una columna en "ClickatonRegistration" a propósito: una
-- columna nueva sin aplicar rompe TODA lectura del modelo.
CREATE TABLE IF NOT EXISTS "ClickatonReferralClaim" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonReferralClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonReferralClaim_registrationId_key"
  ON "ClickatonReferralClaim"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonReferralClaim_code_idx"
  ON "ClickatonReferralClaim"("code");

-- Quién trajo a quién.
CREATE TABLE IF NOT EXISTS "ClickatonReferralAttribution" (
  "id" TEXT NOT NULL,
  "referrerUserId" INTEGER NOT NULL,
  "referredUserId" INTEGER NOT NULL,
  "referredEmail" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "status" "ClickatonReferralAttributionStatus" NOT NULL DEFAULT 'EARNED',
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "consumedAt" TIMESTAMP(3),
  "consumedRegistrationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClickatonReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- Cada persona cuenta una sola vez en su vida: el único de referredUserId es
-- la regla, no una optimización. Lo mismo registrationId, que hace la
-- atribución idempotente frente a los tres caminos que confirman un pago.
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonReferralAttribution_referredUserId_key"
  ON "ClickatonReferralAttribution"("referredUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClickatonReferralAttribution_registrationId_key"
  ON "ClickatonReferralAttribution"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttribution_referrerUserId_status_idx"
  ON "ClickatonReferralAttribution"("referrerUserId", "status");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttribution_referralCodeId_idx"
  ON "ClickatonReferralAttribution"("referralCodeId");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttribution_editionId_idx"
  ON "ClickatonReferralAttribution"("editionId");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttribution_consumedRegistrationId_idx"
  ON "ClickatonReferralAttribution"("consumedRegistrationId");

-- Todo intento, incluido el que no prosperó.
CREATE TABLE IF NOT EXISTS "ClickatonReferralAttributionAttempt" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referrerUserId" INTEGER,
  "referredUserId" INTEGER,
  "referredEmail" TEXT,
  "registrationId" TEXT,
  "outcome" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickatonReferralAttributionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClickatonReferralAttributionAttempt_outcome_createdAt_idx"
  ON "ClickatonReferralAttributionAttempt"("outcome", "createdAt");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttributionAttempt_code_idx"
  ON "ClickatonReferralAttributionAttempt"("code");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttributionAttempt_registrationId_idx"
  ON "ClickatonReferralAttributionAttempt"("registrationId");
CREATE INDEX IF NOT EXISTS "ClickatonReferralAttributionAttempt_createdAt_idx"
  ON "ClickatonReferralAttributionAttempt"("createdAt");

DO $$ BEGIN
  ALTER TABLE "ClickatonReferralCode"
    ADD CONSTRAINT "ClickatonReferralCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonReferralAttribution"
    ADD CONSTRAINT "ClickatonReferralAttribution_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClickatonReferralAttribution"
    ADD CONSTRAINT "ClickatonReferralAttribution_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Restrict: un código con atribuciones vivas no se borra, se desactiva.
DO $$ BEGIN
  ALTER TABLE "ClickatonReferralAttribution"
    ADD CONSTRAINT "ClickatonReferralAttribution_referralCodeId_fkey"
    FOREIGN KEY ("referralCodeId") REFERENCES "ClickatonReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
