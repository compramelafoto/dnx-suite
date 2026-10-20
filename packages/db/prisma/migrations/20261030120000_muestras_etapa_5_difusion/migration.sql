-- Muestras Fotográficas · Etapa 5: difusión y equipo (equipo de la muestra, inauguración con
-- confirmación de asistencia; las piezas para redes no guardan nada).
-- Aditiva: suma once columnas a CulturalActivity (optativas o con valor por defecto constante:
-- Postgres no reescribe la tabla) y crea dos tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`), DESPUÉS de la etapa 4
-- (20261029120000_muestras_etapa_4_sala), y la registra en `_prisma_migrations` con el SHA-256 de
-- este archivo. Va ANTES de publicar el código: sin las columnas nuevas, toda consulta de
-- CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "editVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedByUserId" INTEGER,
ADD COLUMN     "lastEditedPart" TEXT,
ADD COLUMN     "openingEndsAt" TIMESTAMP(3),
ADD COLUMN     "openingNote" TEXT,
ADD COLUMN     "rsvpCapacity" INTEGER,
ADD COLUMN     "rsvpMaxCompanions" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "rsvpPurgedAt" TIMESTAMP(3),
ADD COLUMN     "rsvpStatus" TEXT NOT NULL DEFAULT 'OFF',
ADD COLUMN     "rsvpSummary" JSONB;

-- CreateTable
CREATE TABLE "CulturalActivityMember" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" INTEGER NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CulturalActivityRsvp" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "companions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "manageTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "CulturalActivityRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_tokenHash_key" ON "CulturalActivityMember"("tokenHash");

-- CreateIndex
CREATE INDEX "CulturalActivityMember_userId_status_idx" ON "CulturalActivityMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_activityId_email_key" ON "CulturalActivityMember"("activityId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityMember_activityId_userId_key" ON "CulturalActivityMember"("activityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRsvp_manageTokenHash_key" ON "CulturalActivityRsvp"("manageTokenHash");

-- CreateIndex
CREATE INDEX "CulturalActivityRsvp_activityId_status_createdAt_idx" ON "CulturalActivityRsvp"("activityId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CulturalActivityRsvp_activityId_email_key" ON "CulturalActivityRsvp"("activityId", "email");

-- AddForeignKey
ALTER TABLE "CulturalActivityMember" ADD CONSTRAINT "CulturalActivityMember_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityRsvp" ADD CONSTRAINT "CulturalActivityRsvp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
