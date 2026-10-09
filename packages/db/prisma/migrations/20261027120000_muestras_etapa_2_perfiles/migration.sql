-- Muestras Fotográficas · Etapa 2: perfil público del fotógrafo y vínculo de cada obra.
-- Aditiva: crea la tabla `PhotographerProfile` y agrega una columna opcional a
-- `CulturalActivityWork`. No borra ni actualiza filas.
-- NO SE APLICA SOLA: se corre a mano en la base de FOTOFFICE/FotoRank (Neon
-- `divine-hall-10689679`, rama `development`) con permiso de Daniel, y se registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código.

-- CreateTable
CREATE TABLE "PhotographerProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "city" TEXT,
    "province" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerProfile_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CulturalActivityWork" ADD COLUMN "authorProfileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerProfile_userId_key" ON "PhotographerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotographerProfile_slug_key" ON "PhotographerProfile"("slug");

-- CreateIndex
CREATE INDEX "PhotographerProfile_displayName_idx" ON "PhotographerProfile"("displayName");

-- CreateIndex
CREATE INDEX "CulturalActivityWork_authorProfileId_idx" ON "CulturalActivityWork"("authorProfileId");

-- AddForeignKey
ALTER TABLE "CulturalActivityWork" ADD CONSTRAINT "CulturalActivityWork_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
