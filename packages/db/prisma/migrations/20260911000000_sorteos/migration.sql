-- Sorteos verificables entre socios. Puramente aditiva: cinco tablas nuevas, ninguna
-- columna existente modificada.

CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
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
    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Raffle_workspaceId_drawsAt_idx" ON "Raffle"("workspaceId", "drawsAt");
CREATE INDEX "Raffle_status_entriesCloseAt_idx" ON "Raffle"("status", "entriesCloseAt");
CREATE INDEX "Raffle_status_drawsAt_idx" ON "Raffle"("status", "drawsAt");
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RaffleEntry" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "memberNumberSnapshot" TEXT NOT NULL,
    "fullNameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RaffleEntry_raffleId_memberId_key" ON "RaffleEntry"("raffleId", "memberId");
CREATE UNIQUE INDEX "RaffleEntry_raffleId_position_key" ON "RaffleEntry"("raffleId", "position");
CREATE INDEX "RaffleEntry_memberId_idx" ON "RaffleEntry"("memberId");
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RafflePrize" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "conditions" TEXT,
    "pickupInstructions" TEXT,
    "pickupDeadline" TIMESTAMP(3),
    "estimatedValueMinor" INTEGER,
    "partnerId" TEXT,
    "partnerNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RafflePrize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RafflePrize_raffleId_order_key" ON "RafflePrize"("raffleId", "order");
ALTER TABLE "RafflePrize" ADD CONSTRAINT "RafflePrize_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RafflePrizeAward" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "winnerPosition" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GANADO',
    "notifiedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredByUserId" INTEGER,
    "deliveryNote" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RafflePrizeAward_pkey" PRIMARY KEY ("id")
);
-- Un premio, un ganador. Esta línea es lo que hace idempotente a la resolución.
CREATE UNIQUE INDEX "RafflePrizeAward_prizeId_key" ON "RafflePrizeAward"("prizeId");
CREATE INDEX "RafflePrizeAward_raffleId_status_idx" ON "RafflePrizeAward"("raffleId", "status");
CREATE INDEX "RafflePrizeAward_memberId_idx" ON "RafflePrizeAward"("memberId");
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_prizeId_fkey"
    FOREIGN KEY ("prizeId") REFERENCES "RafflePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RafflePrizeAward" ADD CONSTRAINT "RafflePrizeAward_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RaffleEvent" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "note" TEXT,
    "prizeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaffleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RaffleEvent_raffleId_createdAt_idx" ON "RaffleEvent"("raffleId", "createdAt");
ALTER TABLE "RaffleEvent" ADD CONSTRAINT "RaffleEvent_raffleId_fkey"
    FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
