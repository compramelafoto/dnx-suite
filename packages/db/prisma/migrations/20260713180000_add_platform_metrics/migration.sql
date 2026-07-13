-- Contador histórico de fotos subidas (paridad legacy album_cleanup_pipeline).
-- Idempotente: seguro si la tabla ya existiera en algún entorno.

CREATE TABLE IF NOT EXISTS "PlatformMetrics" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "photosUploadedTotal" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMetrics_pkey" PRIMARY KEY ("id")
);

-- Seed mínimo: id=1 con el conteo actual de Photo (staging puede ser 0).
INSERT INTO "PlatformMetrics" ("id", "photosUploadedTotal", "updatedAt")
SELECT 1, COUNT(*)::bigint, NOW() FROM "Photo"
ON CONFLICT ("id") DO UPDATE
SET "photosUploadedTotal" = GREATEST("PlatformMetrics"."photosUploadedTotal", EXCLUDED."photosUploadedTotal"),
    "updatedAt" = NOW();
