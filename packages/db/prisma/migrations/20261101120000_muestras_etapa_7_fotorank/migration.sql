-- Muestras Fotográficas · Etapa 7: del concurso de FotoRank a la muestra.
-- Aditiva: crea tres tablas nuevas. No agrega columnas a tablas existentes ni toca filas.
-- Sin claves foráneas hacia tablas de FotoRank (las imágenes se copian; borrar un concurso no frena nada).
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de la etapa 6
-- (20261031120000_muestras_etapa_6_expositores) y ANTES de publicar el código, y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo.

-- CreateTable
CREATE TABLE "CulturalContestImport" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "contestSlug" TEXT NOT NULL,
    "contestTitle" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "tiers" TEXT[],
    "resultBatchId" TEXT NOT NULL,
    "resultBatchStatus" TEXT NOT NULL,
    "sourceVersion" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalContestImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalContestWork" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "awardType" TEXT,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "distinction" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "sourceStatus" TEXT NOT NULL DEFAULT 'CURRENT',
    "imageStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT,
    "imageError" TEXT,
    "copiedAt" TIMESTAMP(3),
    "include" BOOLEAN NOT NULL DEFAULT true,
    "toPrint" BOOLEAN NOT NULL DEFAULT true,
    "forSale" BOOLEAN NOT NULL DEFAULT false,
    "exhibitBasis" TEXT NOT NULL,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "exhibitConsent" TEXT NOT NULL DEFAULT 'PENDING',
    "consentBy" TEXT,
    "consentAt" TIMESTAMP(3),
    "saleConsent" TEXT NOT NULL DEFAULT 'NOT_ASKED',
    "saleConsentAt" TIMESTAMP(3),
    "activityWorkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalContestWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalContestAuthor" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" INTEGER,
    "authorName" TEXT NOT NULL,
    "profileId" TEXT,
    "displayName" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "textVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CulturalContestAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalContestImport_activityId_key" ON "CulturalContestImport"("activityId");
CREATE INDEX "CulturalContestImport_contestId_idx" ON "CulturalContestImport"("contestId");
CREATE UNIQUE INDEX "CulturalContestWork_activityId_entryId_key" ON "CulturalContestWork"("activityId", "entryId");
CREATE INDEX "CulturalContestWork_importId_rank_idx" ON "CulturalContestWork"("importId", "rank");
CREATE INDEX "CulturalContestWork_authorUserId_idx" ON "CulturalContestWork"("authorUserId");
CREATE INDEX "CulturalContestWork_activityWorkId_idx" ON "CulturalContestWork"("activityWorkId");
CREATE INDEX "CulturalContestWork_activityId_imageStatus_idx" ON "CulturalContestWork"("activityId", "imageStatus");
CREATE UNIQUE INDEX "CulturalContestAuthor_activityId_userId_key" ON "CulturalContestAuthor"("activityId", "userId");
CREATE INDEX "CulturalContestAuthor_userId_idx" ON "CulturalContestAuthor"("userId");
CREATE INDEX "CulturalContestAuthor_importId_idx" ON "CulturalContestAuthor"("importId");

-- AddForeignKey
ALTER TABLE "CulturalContestImport" ADD CONSTRAINT "CulturalContestImport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestWork" ADD CONSTRAINT "CulturalContestWork_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CulturalContestImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestWork" ADD CONSTRAINT "CulturalContestWork_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CulturalContestImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CulturalContestAuthor" ADD CONSTRAINT "CulturalContestAuthor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
