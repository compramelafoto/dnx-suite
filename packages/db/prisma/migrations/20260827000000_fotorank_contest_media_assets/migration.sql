-- FotoRank — imágenes de concurso cargadas desde el administrador.
--
-- Contexto: hasta ahora el banner, la imagen de tarjeta y la de Open Graph de
-- un concurso vivían como archivos en `public/contest-assets/{slug}/`,
-- declarados en un manifiesto TypeScript. Cambiar una foto exigía un commit y
-- un despliegue. Esta tabla mueve esa decisión al administrador.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Sólo crea un enum y una tabla nuevos; no modifica ni lee ninguna existente.
--   * Sin filas, cada concurso sigue resolviendo su imagen exactamente como
--     hasta ahora (manifiesto curado → coverImageUrl → fallback tipográfico).
--   * Los bytes NO se guardan acá: van al storage privado que FotoRank ya usa
--     para las obras. Esta tabla sólo conserva la referencia y la autoría.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FotorankContestMediaKind') THEN
    CREATE TYPE "FotorankContestMediaKind" AS ENUM ('BANNER', 'CARD', 'SOCIAL');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "FotorankContestMediaAsset" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "kind" "FotorankContestMediaKind" NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local_private',
    "storageBucket" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "originalFileName" TEXT,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT,
    -- Sin texto alternativo la imagen no se publica: es un requisito de
    -- accesibilidad, no un campo opcional.
    "altText" TEXT NOT NULL,
    "focalPointX" INTEGER NOT NULL DEFAULT 50,
    "focalPointY" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUserId" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestMediaAsset_pkey" PRIMARY KEY ("id")
);

-- Resolución de la imagen vigente de un concurso: una sola fila activa por tipo.
CREATE INDEX IF NOT EXISTS "FotorankContestMediaAsset_contestId_kind_isActive_idx"
    ON "FotorankContestMediaAsset"("contestId", "kind", "isActive");

-- Historial de cambios del concurso, del más reciente al más viejo.
CREATE INDEX IF NOT EXISTS "FotorankContestMediaAsset_contestId_uploadedAt_idx"
    ON "FotorankContestMediaAsset"("contestId", "uploadedAt");

CREATE INDEX IF NOT EXISTS "FotorankContestMediaAsset_uploadedByUserId_idx"
    ON "FotorankContestMediaAsset"("uploadedByUserId");

-- Una única imagen activa por concurso y tipo. Lo impone la base, no sólo la
-- aplicación: si un reemplazo fallara a mitad de camino, no puede quedar el
-- concurso con dos banners vigentes.
CREATE UNIQUE INDEX IF NOT EXISTS "FotorankContestMediaAsset_contestId_kind_active_key"
    ON "FotorankContestMediaAsset"("contestId", "kind")
    WHERE "isActive";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestMediaAsset_contestId_fkey') THEN
    ALTER TABLE "FotorankContestMediaAsset"
      ADD CONSTRAINT "FotorankContestMediaAsset_contestId_fkey"
      FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestMediaAsset_uploadedByUserId_fkey') THEN
    ALTER TABLE "FotorankContestMediaAsset"
      ADD CONSTRAINT "FotorankContestMediaAsset_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotorankContestMediaAsset_deletedByUserId_fkey') THEN
    ALTER TABLE "FotorankContestMediaAsset"
      ADD CONSTRAINT "FotorankContestMediaAsset_deletedByUserId_fkey"
      FOREIGN KEY ("deletedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
