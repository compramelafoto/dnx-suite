-- Muestras Fotográficas · Etapa 6: expositores por enlace, portfolio del artista y sorpresa de la muestra.
-- Aditiva: suma una columna optativa a CulturalActivity (Postgres no reescribe la tabla) y crea
-- seis tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de las etapas 4
-- (20261029120000_muestras_etapa_4_sala) y 5 (20261030120000_muestras_etapa_5_difusion), y la
-- registra en `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código:
-- sin la columna nueva, toda consulta de CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "visibility" JSONB;

-- CreateTable
CREATE TABLE "CulturalExhibitorLink" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closesAt" TIMESTAMP(3),
    "maxWorksPerExhibitor" INTEGER,
    "maxExhibitors" INTEGER,
    "instructions" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalExhibitorLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalExhibitor" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "profileId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rightsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedByUserId" INTEGER,

    CONSTRAINT "CulturalExhibitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalExhibitorWork" (
    "id" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "imageUrl" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "technique" TEXT,
    "imageWidthCm" DOUBLE PRECISION,
    "imageHeightCm" DOUBLE PRECISION,
    "frameWidthCm" DOUBLE PRECISION,
    "frameHeightCm" DOUBLE PRECISION,
    "edition" TEXT,
    "editionNumber" INTEGER,
    "editionSize" INTEGER,
    "statement" TEXT,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "priceArs" INTEGER,
    "hangingNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reviewNote" TEXT,
    "activityWorkId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalExhibitorWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotographerPortfolioPhoto" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "technique" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerPortfolioPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalActivityRoomCode" (
    "code" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalActivityRoomCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CulturalActivityRoomKey" (
    "activityId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityRoomKey_pkey" PRIMARY KEY ("activityId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitorLink_activityId_key" ON "CulturalExhibitorLink"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitorLink_token_key" ON "CulturalExhibitorLink"("token");

-- CreateIndex
CREATE INDEX "CulturalExhibitor_userId_status_idx" ON "CulturalExhibitor"("userId", "status");

-- CreateIndex
CREATE INDEX "CulturalExhibitor_profileId_idx" ON "CulturalExhibitor"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalExhibitor_activityId_userId_key" ON "CulturalExhibitor"("activityId", "userId");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_exhibitorId_sortOrder_idx" ON "CulturalExhibitorWork"("exhibitorId", "sortOrder");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_activityId_status_idx" ON "CulturalExhibitorWork"("activityId", "status");

-- CreateIndex
CREATE INDEX "CulturalExhibitorWork_activityWorkId_idx" ON "CulturalExhibitorWork"("activityWorkId");

-- CreateIndex
CREATE INDEX "PhotographerPortfolioPhoto_profileId_sortOrder_idx" ON "PhotographerPortfolioPhoto"("profileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRoomCode_activityId_workId_key" ON "CulturalActivityRoomCode"("activityId", "workId");

-- AddForeignKey
ALTER TABLE "CulturalExhibitorLink" ADD CONSTRAINT "CulturalExhibitorLink_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitor" ADD CONSTRAINT "CulturalExhibitor_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitor" ADD CONSTRAINT "CulturalExhibitor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitorWork" ADD CONSTRAINT "CulturalExhibitorWork_exhibitorId_fkey" FOREIGN KEY ("exhibitorId") REFERENCES "CulturalExhibitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalExhibitorWork" ADD CONSTRAINT "CulturalExhibitorWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotographerPortfolioPhoto" ADD CONSTRAINT "PhotographerPortfolioPhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomCode" ADD CONSTRAINT "CulturalActivityRoomCode_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRoomKey" ADD CONSTRAINT "CulturalActivityRoomKey_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
