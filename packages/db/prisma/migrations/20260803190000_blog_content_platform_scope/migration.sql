-- CMS ETAPA 03 — Blog content platform scope (additive, safe backfill)
-- Scope: BlogPost, BlogCategory, BlogTag, BlogAuthor, BlogMedia
-- Does NOT touch BlogPostTag, BlogPostView, BlogSubscriber

-- =============================================================================
-- A. ADD COLUMN platform TEXT (nullable)
-- =============================================================================
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "BlogCategory" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "BlogTag" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "BlogAuthor" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "BlogMedia" ADD COLUMN IF NOT EXISTS "platform" TEXT;

-- =============================================================================
-- B. Backfill existing rows to CLF
-- =============================================================================
UPDATE "BlogPost" SET "platform" = 'compramelafoto' WHERE "platform" IS NULL;
UPDATE "BlogCategory" SET "platform" = 'compramelafoto' WHERE "platform" IS NULL;
UPDATE "BlogTag" SET "platform" = 'compramelafoto' WHERE "platform" IS NULL;
UPDATE "BlogAuthor" SET "platform" = 'compramelafoto' WHERE "platform" IS NULL;
UPDATE "BlogMedia" SET "platform" = 'compramelafoto' WHERE "platform" IS NULL;

-- =============================================================================
-- C. Assert no NULL platforms remain
-- =============================================================================
DO $$
DECLARE
  null_posts INTEGER;
  null_categories INTEGER;
  null_tags INTEGER;
  null_authors INTEGER;
  null_media INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_posts FROM "BlogPost" WHERE "platform" IS NULL;
  SELECT COUNT(*) INTO null_categories FROM "BlogCategory" WHERE "platform" IS NULL;
  SELECT COUNT(*) INTO null_tags FROM "BlogTag" WHERE "platform" IS NULL;
  SELECT COUNT(*) INTO null_authors FROM "BlogAuthor" WHERE "platform" IS NULL;
  SELECT COUNT(*) INTO null_media FROM "BlogMedia" WHERE "platform" IS NULL;

  IF null_posts > 0 OR null_categories > 0 OR null_tags > 0 OR null_authors > 0 OR null_media > 0 THEN
    RAISE EXCEPTION
      'blog_content_platform_scope: NULL platform remaining (posts=%, categories=%, tags=%, authors=%, media=%)',
      null_posts, null_categories, null_tags, null_authors, null_media;
  END IF;
END $$;

-- =============================================================================
-- D. Create composite unique indexes (Prisma names: *_platform_slug_key)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_platform_slug_key" ON "BlogPost"("platform", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogCategory_platform_slug_key" ON "BlogCategory"("platform", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogTag_platform_slug_key" ON "BlogTag"("platform", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogAuthor_platform_slug_key" ON "BlogAuthor"("platform", "slug");

-- =============================================================================
-- E. Drop old slug-only unique constraints/indexes
-- =============================================================================
DROP INDEX IF EXISTS "BlogPost_slug_key";
DROP INDEX IF EXISTS "BlogCategory_slug_key";
DROP INDEX IF EXISTS "BlogTag_slug_key";
DROP INDEX IF EXISTS "BlogAuthor_slug_key";

ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_slug_key";
ALTER TABLE "BlogCategory" DROP CONSTRAINT IF EXISTS "BlogCategory_slug_key";
ALTER TABLE "BlogTag" DROP CONSTRAINT IF EXISTS "BlogTag_slug_key";
ALTER TABLE "BlogAuthor" DROP CONSTRAINT IF EXISTS "BlogAuthor_slug_key";

-- =============================================================================
-- F. SET NOT NULL
-- =============================================================================
ALTER TABLE "BlogPost" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "BlogCategory" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "BlogTag" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "BlogAuthor" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "BlogMedia" ALTER COLUMN "platform" SET NOT NULL;

-- =============================================================================
-- G. Non-unique indexes matching schema (drop superseded single-column ones)
-- =============================================================================
DROP INDEX IF EXISTS "BlogPost_status_publishedAt_idx";
DROP INDEX IF EXISTS "BlogPost_status_isFeatured_idx";
DROP INDEX IF EXISTS "BlogPost_categoryId_idx";
DROP INDEX IF EXISTS "BlogPost_type_idx";
DROP INDEX IF EXISTS "BlogCategory_sortOrder_idx";
DROP INDEX IF EXISTS "BlogAuthor_isActive_idx";
DROP INDEX IF EXISTS "BlogMedia_createdAt_idx";

CREATE INDEX IF NOT EXISTS "BlogPost_platform_status_publishedAt_idx" ON "BlogPost"("platform", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogPost_platform_status_isFeatured_idx" ON "BlogPost"("platform", "status", "isFeatured");
CREATE INDEX IF NOT EXISTS "BlogPost_platform_categoryId_idx" ON "BlogPost"("platform", "categoryId");
CREATE INDEX IF NOT EXISTS "BlogPost_platform_type_idx" ON "BlogPost"("platform", "type");
CREATE INDEX IF NOT EXISTS "BlogCategory_platform_sortOrder_idx" ON "BlogCategory"("platform", "sortOrder");
CREATE INDEX IF NOT EXISTS "BlogAuthor_platform_isActive_idx" ON "BlogAuthor"("platform", "isActive");
CREATE INDEX IF NOT EXISTS "BlogMedia_platform_createdAt_idx" ON "BlogMedia"("platform", "createdAt");
