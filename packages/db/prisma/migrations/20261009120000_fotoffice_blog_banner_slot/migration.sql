-- Artículos del blog destacados como placa del banner del sitio. Tabla nueva; no toca datos ni
-- tablas existentes. Se aplica ANTES de desplegar el código que la usa, y después:
--   npx prisma migrate resolve --applied 20261009120000_fotoffice_blog_banner_slot

-- CreateTable
CREATE TABLE "FotofficeBlogBannerSlot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeBlogBannerSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeBlogBannerSlot_postId_key" ON "FotofficeBlogBannerSlot"("postId");

-- CreateIndex
CREATE INDEX "FotofficeBlogBannerSlot_workspaceId_endsAt_idx" ON "FotofficeBlogBannerSlot"("workspaceId", "endsAt");

-- AddForeignKey
ALTER TABLE "FotofficeBlogBannerSlot" ADD CONSTRAINT "FotofficeBlogBannerSlot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeBlogBannerSlot" ADD CONSTRAINT "FotofficeBlogBannerSlot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
