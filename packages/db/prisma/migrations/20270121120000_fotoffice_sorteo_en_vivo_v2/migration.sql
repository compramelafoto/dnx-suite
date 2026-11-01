-- AlterTable
ALTER TABLE "LiveRaffle" ADD COLUMN     "cooldownDraws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxWinsPerPerson" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "usePrizeList" BOOLEAN NOT NULL DEFAULT true;

-- "Una persona no puede ganar más de un premio" pasa a ser "máximo 1"; sin la regla, sin límite (0).
UPDATE "LiveRaffle" SET "maxWinsPerPerson" = CASE WHEN "oneWinPerPerson" THEN 1 ELSE 0 END;

-- AlterTable
ALTER TABLE "LiveRafflePoll" ADD COLUMN     "allowOther" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'OPCIONES';

-- AlterTable
ALTER TABLE "LiveRaffleVote" ADD COLUMN     "text" TEXT,
ALTER COLUMN "optionIndex" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LiveRaffleDraw" (
    "id" TEXT NOT NULL,
    "liveRaffleId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "entrantId" TEXT NOT NULL,
    "prizeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GANADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRaffleDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRaffleSponsor" (
    "id" TEXT NOT NULL,
    "liveRaffleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT,
    "logoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveRaffleSponsor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveRaffleDraw_liveRaffleId_round_idx" ON "LiveRaffleDraw"("liveRaffleId", "round");

-- CreateIndex
CREATE INDEX "LiveRaffleSponsor_liveRaffleId_order_idx" ON "LiveRaffleSponsor"("liveRaffleId", "order");

-- AddForeignKey
ALTER TABLE "LiveRaffleDraw" ADD CONSTRAINT "LiveRaffleDraw_liveRaffleId_fkey" FOREIGN KEY ("liveRaffleId") REFERENCES "LiveRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaffleDraw" ADD CONSTRAINT "LiveRaffleDraw_entrantId_fkey" FOREIGN KEY ("entrantId") REFERENCES "LiveRaffleEntrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaffleDraw" ADD CONSTRAINT "LiveRaffleDraw_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "LiveRafflePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveRaffleSponsor" ADD CONSTRAINT "LiveRaffleSponsor_liveRaffleId_fkey" FOREIGN KEY ("liveRaffleId") REFERENCES "LiveRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

