-- Muestras Fotográficas · Etapa 4: la sala (piezas para imprimir, estadísticas, libro de visitas).
-- Aditiva: suma cuatro columnas a CulturalActivity (optativas o con valor por defecto: Postgres no
-- reescribe la tabla) y crea dos tablas nuevas. No toca filas existentes.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank (Neon `divine-hall-10689679`, rama `development`) y la registra en
-- `_prisma_migrations` con el SHA-256 de este archivo. Va ANTES de publicar el código: sin las
-- columnas nuevas, toda consulta de CulturalActivity falla y se cae todo el sitio de Muestras.

-- AlterTable
ALTER TABLE "CulturalActivity" ADD COLUMN     "curatorCredits" TEXT,
ADD COLUMN     "curatorialText" TEXT,
ADD COLUMN     "guestbookMode" TEXT NOT NULL DEFAULT 'PUBLISH',
ADD COLUMN     "hangingPlan" JSONB;

-- CreateTable
CREATE TABLE "CulturalActivityDailyStat" (
    "activityId" TEXT NOT NULL,
    "workId" TEXT NOT NULL DEFAULT '',
    "day" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CulturalActivityDailyStat_pkey" PRIMARY KEY ("activityId","workId","day","metric")
);

-- CreateTable
CREATE TABLE "CulturalActivityGuestbookEntry" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "comment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "moderatedAt" TIMESTAMP(3),
    "moderatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CulturalActivityGuestbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CulturalActivityGuestbookEntry_activityId_status_createdAt_idx" ON "CulturalActivityGuestbookEntry"("activityId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "CulturalActivityDailyStat" ADD CONSTRAINT "CulturalActivityDailyStat_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CulturalActivityGuestbookEntry" ADD CONSTRAINT "CulturalActivityGuestbookEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CulturalActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
