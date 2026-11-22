-- Muestras de Arte · Etapa 2: disciplinas (fotografía, pintura, escultura, etc.).
-- Aditiva: sólo agrega columnas y un índice. No toca filas existentes: todo lo ya cargado
-- queda como 'FOTOGRAFIA' por el valor por defecto. Sin enums (texto plano), sin FK.
-- NO SE APLICA SOLA: la aplica a mano el controlador (autorizado por Daniel) en la base de
-- FOTOFFICE/FotoRank/Muestras (Neon `divine-hall-10689679`, rama `development`) y la registra
-- en `_prisma_migrations` con el SHA-256 de este archivo.

-- Actividad: disciplina principal y otras disciplinas.
ALTER TABLE "CulturalActivity" ADD COLUMN IF NOT EXISTS "primaryDiscipline" TEXT NOT NULL DEFAULT 'FOTOGRAFIA';
ALTER TABLE "CulturalActivity" ADD COLUMN IF NOT EXISTS "otherDisciplines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Perfil de artista: disciplinas (por defecto fotografía).
ALTER TABLE "PhotographerProfile" ADD COLUMN IF NOT EXISTS "disciplines" TEXT[] NOT NULL DEFAULT ARRAY['FOTOGRAFIA']::TEXT[];

-- Obras: disciplina opcional (null = hereda la del contenedor).
ALTER TABLE "CulturalActivityWork" ADD COLUMN IF NOT EXISTS "discipline" TEXT;
ALTER TABLE "CulturalExhibitorWork" ADD COLUMN IF NOT EXISTS "discipline" TEXT;
ALTER TABLE "CulturalCallWork" ADD COLUMN IF NOT EXISTS "discipline" TEXT;
ALTER TABLE "PhotographerPortfolioPhoto" ADD COLUMN IF NOT EXISTS "discipline" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CulturalActivity_primaryDiscipline_idx" ON "CulturalActivity"("primaryDiscipline");
