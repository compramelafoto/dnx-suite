-- CLF AlbumFolder gap (staging Neon ep-round-fog)
-- Residual blocker after PackDefinition / Photo.previewWatermarkedKey gap:
--   P2021 public.AlbumFolder → GET /album/[slug] (prisma.albumFolder.findMany)
--
-- Scope: AlbumFolder table + indexes + FKs strictly required by schema.
-- No enums (AlbumFolder has none).
-- No EventFolder (not required by AlbumFolder).
--
-- Photo.folderId already exists (20260709210000_add_clf_photo_and_role_gap) without FK.
-- Staging has zero non-null Photo.folderId rows → FK Photo.folderId → AlbumFolder.id is safe.
--
-- Forward-only, additive, idempotent. Preserves existing rows.
-- Do NOT apply to production yet.
--
-- NOTE: timestamp 20260710010000 coexists with applied Infospot migration
--   20260710010000_add_infospot_article_assets (different folder name / checksum).

-- ---------------------------------------------------------------------------
-- AlbumFolder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AlbumFolder" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumFolder_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes (schema-aligned)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "AlbumFolder_albumId_idx" ON "AlbumFolder"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumFolder_parentId_idx" ON "AlbumFolder"("parentId");
CREATE INDEX IF NOT EXISTS "AlbumFolder_albumId_parentId_name_idx"
  ON "AlbumFolder"("albumId", "parentId", "name");

-- Photo.folderId index already created in 20260709210000; keep idempotent.
CREATE INDEX IF NOT EXISTS "Photo_folderId_idx" ON "Photo"("folderId");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "AlbumFolder"
    ADD CONSTRAINT "AlbumFolder_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumFolder"
    ADD CONSTRAINT "AlbumFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "AlbumFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumFolder"
    ADD CONSTRAINT "AlbumFolder_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Safe: no orphan Photo.folderId values on staging at apply time.
DO $$ BEGIN
  ALTER TABLE "Photo"
    ADD CONSTRAINT "Photo_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "AlbumFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
