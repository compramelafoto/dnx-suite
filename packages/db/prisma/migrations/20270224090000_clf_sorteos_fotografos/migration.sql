-- Sorteos de CompraMeLaFoto entre los fotógrafos que vendieron.
-- Sólo tablas nuevas: no toca ninguna existente. Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "ClfRaffle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "period" TEXT,
    "salesFrom" TIMESTAMP(3) NOT NULL,
    "salesTo" TIMESTAMP(3) NOT NULL,
    "minSales" INTEGER NOT NULL DEFAULT 1,
    "entriesCloseAt" TIMESTAMP(3) NOT NULL,
    "drawsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "drandChainHash" TEXT,
    "drandRound" INTEGER,
    "drandRandomness" TEXT,
    "drandSignature" TEXT,
    "entrantsHash" TEXT,
    "entrantsCount" INTEGER,
    "sealedAt" TIMESTAMP(3),
    "drawnAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" INTEGER,
    "announcedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClfRaffle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfRaffleEntry" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "codeSnapshot" TEXT NOT NULL,
    "displayNameSnapshot" TEXT NOT NULL,
    "salesCountSnapshot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClfRaffleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfRafflePrize" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT,
    "sponsorName" TEXT,
    "deliveryInstructions" TEXT,
    "estimatedValueArs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClfRafflePrize_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfRaffleAward" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "entryId" TEXT NOT NULL,
    "winnerPosition" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GANADO',
    "notifiedAt" TIMESTAMP(3),
    "noticeError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveredByUserId" INTEGER,
    "deliveryNote" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClfRaffleAward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfRaffleSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "monthlyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoAnnounce" BOOLEAN NOT NULL DEFAULT true,
    "drawDay" INTEGER NOT NULL DEFAULT 5,
    "drawHour" INTEGER NOT NULL DEFAULT 20,
    "minSales" INTEGER NOT NULL DEFAULT 1,
    "monthlyPrizes" JSONB NOT NULL DEFAULT '[]',
    "excludedUserIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClfRaffleSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfRaffleEvent" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "note" TEXT,
    "prizeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClfRaffleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClfRaffle_period_key" ON "ClfRaffle"("period");
CREATE INDEX IF NOT EXISTS "ClfRaffle_status_entriesCloseAt_idx" ON "ClfRaffle"("status", "entriesCloseAt");
CREATE INDEX IF NOT EXISTS "ClfRaffle_status_drawsAt_idx" ON "ClfRaffle"("status", "drawsAt");
CREATE INDEX IF NOT EXISTS "ClfRaffle_drawsAt_idx" ON "ClfRaffle"("drawsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ClfRaffleEntry_raffleId_userId_key" ON "ClfRaffleEntry"("raffleId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClfRaffleEntry_raffleId_position_key" ON "ClfRaffleEntry"("raffleId", "position");
CREATE INDEX IF NOT EXISTS "ClfRaffleEntry_userId_idx" ON "ClfRaffleEntry"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClfRafflePrize_raffleId_order_key" ON "ClfRafflePrize"("raffleId", "order");

CREATE UNIQUE INDEX IF NOT EXISTS "ClfRaffleAward_prizeId_key" ON "ClfRaffleAward"("prizeId");
CREATE INDEX IF NOT EXISTS "ClfRaffleAward_raffleId_status_idx" ON "ClfRaffleAward"("raffleId", "status");
CREATE INDEX IF NOT EXISTS "ClfRaffleAward_userId_idx" ON "ClfRaffleAward"("userId");

CREATE INDEX IF NOT EXISTS "ClfRaffleEvent_raffleId_createdAt_idx" ON "ClfRaffleEvent"("raffleId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ClfRaffleEntry" ADD CONSTRAINT "ClfRaffleEntry_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "ClfRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClfRafflePrize" ADD CONSTRAINT "ClfRafflePrize_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "ClfRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClfRaffleAward" ADD CONSTRAINT "ClfRaffleAward_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "ClfRafflePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClfRaffleAward" ADD CONSTRAINT "ClfRaffleAward_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "ClfRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClfRaffleEvent" ADD CONSTRAINT "ClfRaffleEvent_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "ClfRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
