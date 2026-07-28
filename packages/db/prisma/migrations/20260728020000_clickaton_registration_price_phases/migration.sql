-- Clickatón Etapa 2: fases de precio por edición + snapshot en inscripción.
-- Additive only.

CREATE TABLE "ClickatonRegistrationPricePhase" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickatonRegistrationPricePhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonRegistrationPricePhase_editionId_isActive_idx"
  ON "ClickatonRegistrationPricePhase"("editionId", "isActive");

CREATE INDEX "ClickatonRegistrationPricePhase_editionId_startsAt_endsAt_idx"
  ON "ClickatonRegistrationPricePhase"("editionId", "startsAt", "endsAt");

CREATE INDEX "ClickatonRegistrationPricePhase_editionId_priority_idx"
  ON "ClickatonRegistrationPricePhase"("editionId", "priority");

ALTER TABLE "ClickatonRegistrationPricePhase"
  ADD CONSTRAINT "ClickatonRegistrationPricePhase_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClickatonRegistration"
  ADD COLUMN "pricePhaseId" TEXT,
  ADD COLUMN "pricePhaseNameSnapshot" TEXT,
  ADD COLUMN "pricePhaseAmountSnapshot" INTEGER;
