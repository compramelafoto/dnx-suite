-- Muestras Fotográficas · Etapa 1: actividades culturales y su galería.
-- Crea dos tablas nuevas (`CulturalActivity` y `CulturalActivityWork`). No toca tablas existentes,
-- no borra ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en la base de FOTOFFICE/FotoRank
-- (Neon `divine-hall-10689679`, rama `development`) con permiso de Daniel, y se registra con
-- `prisma migrate resolve --applied 20261025120000_muestras_etapa_1`.
-- Las otras bases no la necesitan: ninguna otra app consulta estas tablas.

-- CreateTable
CREATE TABLE "CulturalActivity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "organizersText" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "openingAt" TIMESTAMP(3),
    "scheduleText" TEXT,
    "priceText" TEXT,
    "externalUrl" TEXT,
    "isVirtualOnly" BOOLEAN NOT NULL DEFAULT false,
    "venueName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geohash" TEXT,
    "workspaceId" TEXT,
    "proposedByUserId" INTEGER NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "galleryMode" TEXT NOT NULL DEFAULT 'HIGHLIGHTS_UNTIL_CLOSED',
    "rightsConfirmedAt" TIMESTAMP(3),
    "blogPostId" INTEGER,
    "itinerantGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalActivityWork" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "year" INTEGER,
    "technique" TEXT,
    "isHighlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalActivityWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivity_slug_key" ON "CulturalActivity"("slug");

-- CreateIndex
CREATE INDEX "CulturalActivity_reviewStatus_endsAt_idx" ON "CulturalActivity"("reviewStatus", "endsAt");

-- CreateIndex
CREATE INDEX "CulturalActivity_proposedByUserId_idx" ON "CulturalActivity"("proposedByUserId");

-- CreateIndex
CREATE INDEX "CulturalActivity_workspaceId_idx" ON "CulturalActivity"("workspaceId");

-- CreateIndex
CREATE INDEX "CulturalActivity_geohash_idx" ON "CulturalActivity"("geohash");

-- CreateIndex
CREATE INDEX "CulturalActivityWork_activityId_sortOrder_idx" ON "CulturalActivityWork"("activityId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CulturalActivityWork" ADD CONSTRAINT "CulturalActivityWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

