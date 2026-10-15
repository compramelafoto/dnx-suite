-- Los videos del portfolio de un socio.
--
-- No se guarda el archivo: un video pesa cientos de megas y ya está alojado donde el socio lo
-- subió. Se guarda de dónde viene y cómo mostrarlo.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

-- CreateTable
CREATE TABLE "FotofficeMemberPortfolioVideo" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "videoId" TEXT,
    "title" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeMemberPortfolioVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- El índice de la sección: los videos de un portfolio, en su orden.
CREATE INDEX "FotofficeMemberPortfolioVideo_portfolioId_order_idx" ON "FotofficeMemberPortfolioVideo"("portfolioId", "order");

-- AddForeignKey
ALTER TABLE "FotofficeMemberPortfolioVideo" ADD CONSTRAINT "FotofficeMemberPortfolioVideo_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "FotofficeMemberPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
