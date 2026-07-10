-- CLF AlbumPack + OrganizerPublicProfile gap (monorepo schema vs staging Neon)
-- Staging ep-round-fog is missing AlbumPack* and OrganizerPublicProfile* tables.
-- Missing AlbumPack causes P2021 on GET /album/[slug] (packs include).
-- Missing OrganizerPublicProfile causes P2021 on checkout / organizer landing.
--
-- Forward-only, additive, idempotent. Preserves existing rows.
-- Do NOT apply to production yet.
--
-- Scope: AlbumPack domain + OrganizerPublicProfile domain (+ child tables).
-- Intentionally skips TemplateV2* tables (absent on staging); AlbumPack.templateV2Id
-- is added as nullable TEXT without FK so Prisma can select packs without design V2.

-- ---------------------------------------------------------------------------
-- Enums (create if missing)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "AlbumPackComponentKind" AS ENUM ('DIGITAL', 'PRINT', 'DESIGN_PRODUCT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlbumPackAvailabilityPhase" AS ENUM ('PRE_UPLOAD', 'POST_UPLOAD', 'ALWAYS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlbumPackType" AS ENUM ('DIGITAL', 'PRINT', 'SCHOOL_FOLDER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlbumPackSelectionStatus" AS ENUM ('DRAFT', 'READY', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AlbumPackOrderDraftStatus" AS ENUM ('DRAFT', 'LOCKED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- AlbumPack domain
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AlbumPack" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "includedPhotoCount" INTEGER,
    "requiresSelection" BOOLEAN NOT NULL DEFAULT false,
    "requiresDesign" BOOLEAN NOT NULL DEFAULT false,
    "templateId" INTEGER,
    "templateV2Id" TEXT,
    "availabilityPhase" "AlbumPackAvailabilityPhase" NOT NULL,
    "packType" "AlbumPackType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumPack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlbumPackComponent" (
    "id" TEXT NOT NULL,
    "albumPackId" TEXT NOT NULL,
    "kind" "AlbumPackComponentKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unitsPerSelection" INTEGER NOT NULL DEFAULT 1,
    "photographerProductId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumPackComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlbumPackSelectionSession" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "albumPackId" TEXT NOT NULL,
    "guestToken" TEXT,
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "status" "AlbumPackSelectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AlbumPackSelectionSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlbumPackOrderDraft" (
    "id" TEXT NOT NULL,
    "albumId" INTEGER NOT NULL,
    "albumPackId" TEXT NOT NULL,
    "selectionSessionId" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerName" TEXT,
    "buyerPhone" TEXT,
    "guestToken" TEXT,
    "status" "AlbumPackOrderDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL,
    "pricingSnapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AlbumPackOrderDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlbumPackSelectionPhoto" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "photoId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumPackSelectionPhoto_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Organizer public landing domain
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizerPublicProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "logoR2Key" TEXT,
    "bannerR2Key" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "city" TEXT,
    "zone" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "whatsapp" TEXT,
    "publicEmail" TEXT,
    "modulesJson" JSONB NOT NULL DEFAULT '{}',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerPublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizerOfficialPhotographer" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "photographerUserId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerOfficialPhotographer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizerFeaturedGallery" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "albumId" INTEGER,
    "eventId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerFeaturedGallery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizerLandingSponsor" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logoR2Key" TEXT,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerLandingSponsor_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes (idempotent)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "AlbumPack_albumId_idx" ON "AlbumPack"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumPack_templateId_idx" ON "AlbumPack"("templateId");
CREATE INDEX IF NOT EXISTS "AlbumPack_templateV2Id_idx" ON "AlbumPack"("templateV2Id");
CREATE INDEX IF NOT EXISTS "AlbumPack_isActive_idx" ON "AlbumPack"("isActive");

CREATE INDEX IF NOT EXISTS "AlbumPackComponent_albumPackId_idx" ON "AlbumPackComponent"("albumPackId");
CREATE INDEX IF NOT EXISTS "AlbumPackComponent_photographerProductId_idx" ON "AlbumPackComponent"("photographerProductId");

CREATE INDEX IF NOT EXISTS "AlbumPackSelectionSession_albumId_idx" ON "AlbumPackSelectionSession"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumPackSelectionSession_albumPackId_idx" ON "AlbumPackSelectionSession"("albumPackId");
CREATE INDEX IF NOT EXISTS "AlbumPackSelectionSession_status_idx" ON "AlbumPackSelectionSession"("status");
CREATE INDEX IF NOT EXISTS "AlbumPackSelectionSession_guestToken_idx" ON "AlbumPackSelectionSession"("guestToken");

CREATE INDEX IF NOT EXISTS "AlbumPackOrderDraft_albumId_idx" ON "AlbumPackOrderDraft"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumPackOrderDraft_albumPackId_idx" ON "AlbumPackOrderDraft"("albumPackId");
CREATE INDEX IF NOT EXISTS "AlbumPackOrderDraft_selectionSessionId_idx" ON "AlbumPackOrderDraft"("selectionSessionId");
CREATE INDEX IF NOT EXISTS "AlbumPackOrderDraft_status_idx" ON "AlbumPackOrderDraft"("status");
CREATE INDEX IF NOT EXISTS "AlbumPackOrderDraft_guestToken_idx" ON "AlbumPackOrderDraft"("guestToken");

CREATE INDEX IF NOT EXISTS "AlbumPackSelectionPhoto_sessionId_idx" ON "AlbumPackSelectionPhoto"("sessionId");
CREATE INDEX IF NOT EXISTS "AlbumPackSelectionPhoto_photoId_idx" ON "AlbumPackSelectionPhoto"("photoId");
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumPackSelectionPhoto_sessionId_photoId_key" ON "AlbumPackSelectionPhoto"("sessionId", "photoId");

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizerPublicProfile_userId_key" ON "OrganizerPublicProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizerPublicProfile_publicSlug_key" ON "OrganizerPublicProfile"("publicSlug");
CREATE INDEX IF NOT EXISTS "OrganizerPublicProfile_isPublished_idx" ON "OrganizerPublicProfile"("isPublished");

CREATE INDEX IF NOT EXISTS "OrganizerOfficialPhotographer_profileId_sortOrder_idx" ON "OrganizerOfficialPhotographer"("profileId", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizerOfficialPhotographer_profileId_isActive_idx" ON "OrganizerOfficialPhotographer"("profileId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizerOfficialPhotographer_profileId_photographerUserId_key" ON "OrganizerOfficialPhotographer"("profileId", "photographerUserId");

CREATE INDEX IF NOT EXISTS "OrganizerFeaturedGallery_profileId_sortOrder_idx" ON "OrganizerFeaturedGallery"("profileId", "sortOrder");
CREATE INDEX IF NOT EXISTS "OrganizerFeaturedGallery_profileId_isActive_idx" ON "OrganizerFeaturedGallery"("profileId", "isActive");

CREATE INDEX IF NOT EXISTS "OrganizerLandingSponsor_profileId_sortOrder_idx" ON "OrganizerLandingSponsor"("profileId", "sortOrder");

-- ---------------------------------------------------------------------------
-- Foreign keys (add only if missing). No FK to TemplateV2 (table absent).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "AlbumPack"
    ADD CONSTRAINT "AlbumPack_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPack"
    ADD CONSTRAINT "AlbumPack_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackComponent"
    ADD CONSTRAINT "AlbumPackComponent_albumPackId_fkey"
    FOREIGN KEY ("albumPackId") REFERENCES "AlbumPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackComponent"
    ADD CONSTRAINT "AlbumPackComponent_photographerProductId_fkey"
    FOREIGN KEY ("photographerProductId") REFERENCES "PhotographerProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackSelectionSession"
    ADD CONSTRAINT "AlbumPackSelectionSession_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackSelectionSession"
    ADD CONSTRAINT "AlbumPackSelectionSession_albumPackId_fkey"
    FOREIGN KEY ("albumPackId") REFERENCES "AlbumPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackOrderDraft"
    ADD CONSTRAINT "AlbumPackOrderDraft_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackOrderDraft"
    ADD CONSTRAINT "AlbumPackOrderDraft_albumPackId_fkey"
    FOREIGN KEY ("albumPackId") REFERENCES "AlbumPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackOrderDraft"
    ADD CONSTRAINT "AlbumPackOrderDraft_selectionSessionId_fkey"
    FOREIGN KEY ("selectionSessionId") REFERENCES "AlbumPackSelectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackSelectionPhoto"
    ADD CONSTRAINT "AlbumPackSelectionPhoto_photoId_fkey"
    FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AlbumPackSelectionPhoto"
    ADD CONSTRAINT "AlbumPackSelectionPhoto_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AlbumPackSelectionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerPublicProfile"
    ADD CONSTRAINT "OrganizerPublicProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerOfficialPhotographer"
    ADD CONSTRAINT "OrganizerOfficialPhotographer_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "OrganizerPublicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerOfficialPhotographer"
    ADD CONSTRAINT "OrganizerOfficialPhotographer_photographerUserId_fkey"
    FOREIGN KEY ("photographerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerFeaturedGallery"
    ADD CONSTRAINT "OrganizerFeaturedGallery_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "OrganizerPublicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerFeaturedGallery"
    ADD CONSTRAINT "OrganizerFeaturedGallery_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerFeaturedGallery"
    ADD CONSTRAINT "OrganizerFeaturedGallery_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrganizerLandingSponsor"
    ADD CONSTRAINT "OrganizerLandingSponsor_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "OrganizerPublicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
