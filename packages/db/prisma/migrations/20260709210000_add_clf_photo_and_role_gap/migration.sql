-- CLF Photo columns + Role.SCHOOL_ORGANIZER gap (staging Neon ep-round-fog)
-- Residual blockers after AlbumPack / OrganizerPublicProfile gap:
--   P2022 Photo.folderId          → GET /album/[slug]
--   P2022 Photo.thumbWatermarkedKey → GET /api/photos/[id]/view
--   22P02 Role missing SCHOOL_ORGANIZER → checkout organizerPublicProfile filter
--
-- Also adds Photo.eventFolderId (nullable, no FK): same album select includes it;
-- without it the next P2022 would still block the album page.
--
-- Forward-only, additive, idempotent. Preserves existing rows.
-- Do NOT apply to production yet.
--
-- AlbumFolder / EventFolder tables are ABSENT on staging → no FK constraints.
-- Indexes on folderId / eventFolderId are still created (schema expects them).

-- ---------------------------------------------------------------------------
-- Role enum: add SCHOOL_ORGANIZER if missing
-- ---------------------------------------------------------------------------
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCHOOL_ORGANIZER';

-- ---------------------------------------------------------------------------
-- Photo columns
-- ---------------------------------------------------------------------------
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "folderId" INTEGER;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "eventFolderId" INTEGER;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "thumbWatermarkedKey" TEXT;

-- ---------------------------------------------------------------------------
-- Indexes expected by schema (idempotent). No FKs: AlbumFolder/EventFolder missing.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Photo_folderId_idx" ON "Photo"("folderId");
CREATE INDEX IF NOT EXISTS "Photo_eventFolderId_idx" ON "Photo"("eventFolderId");
