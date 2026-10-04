-- Portfolio de socios de FOTOFFICE: una galería por persona del padrón, publicable en el
-- sitio público de la institución.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

-- Dos acciones nuevas de auditoría. Agregar un valor a un enum no toca ninguna fila existente.
-- ALTER TYPE ... ADD VALUE no puede USARSE en la misma transacción que lo agrega; acá sólo se
-- agrega, así que es seguro.
ALTER TYPE "MemberAuditAction" ADD VALUE IF NOT EXISTS 'PORTFOLIO_HIDDEN';
ALTER TYPE "MemberAuditAction" ADD VALUE IF NOT EXISTS 'PORTFOLIO_RESTORED';

-- CreateTable
CREATE TABLE "FotofficeMemberPortfolio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "memberPublished" BOOLEAN NOT NULL DEFAULT false,
    "memberPublishedAt" TIMESTAMP(3),
    "coverPhotoId" TEXT,
    "hiddenByAdminAt" TIMESTAMP(3),
    "hiddenByAdminUserId" INTEGER,
    "hiddenReason" TEXT,
    "adminForcePublish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeMemberPortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeMemberPortfolioPhoto" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeMemberPortfolioPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeMemberPortfolio_memberId_key" ON "FotofficeMemberPortfolio"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeMemberPortfolio_coverPhotoId_key" ON "FotofficeMemberPortfolio"("coverPhotoId");

-- CreateIndex
-- Dos personas de la misma institución no pueden compartir dirección pública.
CREATE UNIQUE INDEX "FotofficeMemberPortfolio_workspaceId_publicSlug_key" ON "FotofficeMemberPortfolio"("workspaceId", "publicSlug");

-- CreateIndex
CREATE INDEX "FotofficeMemberPortfolio_workspaceId_idx" ON "FotofficeMemberPortfolio"("workspaceId");

-- CreateIndex
-- El índice del directorio y de la galería: las fotos de un portfolio, en su orden.
CREATE INDEX "FotofficeMemberPortfolioPhoto_portfolioId_order_idx" ON "FotofficeMemberPortfolioPhoto"("portfolioId", "order");

-- AddForeignKey
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull: borrar el usuario del administrador no borra el hecho de que bajó el portfolio.
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_hiddenByAdminUserId_fkey" FOREIGN KEY ("hiddenByAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull: borrar la foto destacada no borra el portfolio; queda sin destacada y la aplicación
-- reasigna la primera que quede.
ALTER TABLE "FotofficeMemberPortfolio" ADD CONSTRAINT "FotofficeMemberPortfolio_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "FotofficeMemberPortfolioPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeMemberPortfolioPhoto" ADD CONSTRAINT "FotofficeMemberPortfolioPhoto_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "FotofficeMemberPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
