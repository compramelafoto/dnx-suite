-- CreateTable
CREATE TABLE "LiveRaffle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rulesText" TEXT,
    "logoUrl" TEXT,
    "publicCode" TEXT NOT NULL,
    "screenToken" TEXT NOT NULL,
    "dedupMode" TEXT NOT NULL DEFAULT 'CELULAR',
    "oneWinPerPerson" BOOLEAN NOT NULL DEFAULT true,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveRaffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRaffleEntrant" (
    "id" TEXT NOT NULL,
    "liveRaffleId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "dni" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRaffleEntrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRafflePrize" (
    "id" TEXT NOT NULL,
    "liveRaffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sponsorName" TEXT,
    "sponsorLogoUrl" TEXT,
    "winnerEntrantId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "absentEntrantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRafflePrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRafflePoll" (
    "id" TEXT NOT NULL,
    "liveRaffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRafflePoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRaffleVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "entrantId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRaffleVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaffle_publicCode_key" ON "LiveRaffle"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaffle_screenToken_key" ON "LiveRaffle"("screenToken");

-- CreateIndex
CREATE INDEX "LiveRaffle_workspaceId_createdAt_idx" ON "LiveRaffle"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaffleEntrant_liveRaffleId_phone_key" ON "LiveRaffleEntrant"("liveRaffleId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaffleEntrant_liveRaffleId_dni_key" ON "LiveRaffleEntrant"("liveRaffleId", "dni");

-- CreateIndex
CREATE INDEX "LiveRafflePrize_liveRaffleId_order_idx" ON "LiveRafflePrize"("liveRaffleId", "order");

-- CreateIndex
CREATE INDEX "LiveRafflePoll_liveRaffleId_order_idx" ON "LiveRafflePoll"("liveRaffleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LiveRaffleVote_pollId_entrantId_key" ON "LiveRaffleVote"("pollId", "entrantId");

-- AddForeignKey
ALTER TABLE "LiveRaffleEntrant" ADD CONSTRAINT "LiveRaffleEntrant_liveRaffleId_fkey" FOREIGN KEY ("liveRaffleId") REFERENCES "LiveRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRafflePrize" ADD CONSTRAINT "LiveRafflePrize_liveRaffleId_fkey" FOREIGN KEY ("liveRaffleId") REFERENCES "LiveRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRafflePoll" ADD CONSTRAINT "LiveRafflePoll_liveRaffleId_fkey" FOREIGN KEY ("liveRaffleId") REFERENCES "LiveRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaffleVote" ADD CONSTRAINT "LiveRaffleVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "LiveRafflePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaffleVote" ADD CONSTRAINT "LiveRaffleVote_entrantId_fkey" FOREIGN KEY ("entrantId") REFERENCES "LiveRaffleEntrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

