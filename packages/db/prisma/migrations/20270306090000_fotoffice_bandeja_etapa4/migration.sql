-- Bandeja de WhatsApp, etapa 4 (diseño 2026-11-24): campaña de Meta de cada chat.
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "anuncioId" TEXT;
CREATE INDEX IF NOT EXISTS "FotofficeWaChat_workspaceId_anuncioId_idx" ON "FotofficeWaChat"("workspaceId", "anuncioId");

CREATE TABLE IF NOT EXISTS "FotofficeMetaAnuncio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "titulo" TEXT,
    "adName" TEXT,
    "adsetName" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "consultadoEn" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeMetaAnuncio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeMetaAnuncio_workspaceId_adId_key" ON "FotofficeMetaAnuncio"("workspaceId", "adId");
CREATE INDEX IF NOT EXISTS "FotofficeMetaAnuncio_workspaceId_campaignId_idx" ON "FotofficeMetaAnuncio"("workspaceId", "campaignId");

-- Relleno: el anuncio del ÚLTIMO mensaje con referral de cada chat (no pisa uno ya puesto).
UPDATE "FotofficeWaChat" c
SET "anuncioId" = u.ad
FROM (
  SELECT DISTINCT ON (m."chatId") m."chatId", m.media->'anuncio'->>'id' AS ad
  FROM "FotofficeWaMensaje" m
  WHERE m.media ? 'anuncio' AND (m.media->'anuncio'->>'id') IS NOT NULL
  ORDER BY m."chatId", m."createdAt" DESC
) u
WHERE c.id = u."chatId" AND c."anuncioId" IS NULL;

-- Un registro por anuncio, con el título del referral más reciente (la campaña se le pregunta a Meta).
INSERT INTO "FotofficeMetaAnuncio" ("id", "workspaceId", "adId", "titulo", "updatedAt")
SELECT 'ma_' || md5(t."workspaceId" || ':' || t.ad), t."workspaceId", t.ad, t.titulo, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (m."workspaceId", m.media->'anuncio'->>'id') m."workspaceId", m.media->'anuncio'->>'id' AS ad, left(m.media->'anuncio'->>'titulo', 200) AS titulo
  FROM "FotofficeWaMensaje" m
  WHERE m.media ? 'anuncio' AND (m.media->'anuncio'->>'id') IS NOT NULL
  ORDER BY m."workspaceId", m.media->'anuncio'->>'id', m."createdAt" DESC
) t
ON CONFLICT ("workspaceId", "adId") DO NOTHING;
