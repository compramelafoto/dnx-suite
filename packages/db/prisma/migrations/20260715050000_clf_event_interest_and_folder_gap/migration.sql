-- Gap staging CLF: EventInterest + EventFolder (schema ya los declara; Preview no los tenía).
-- Idempotente. No toca producción desde este archivo; se aplica con migrate deploy al target elegido.

-- 1) EventInterest
CREATE TABLE IF NOT EXISTS "EventInterest" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "lastName" TEXT,
    "whatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),
    "notifiedWhenReady" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventInterest_eventId_email_key" ON "EventInterest"("eventId", "email");
CREATE INDEX IF NOT EXISTS "EventInterest_eventId_idx" ON "EventInterest"("eventId");
CREATE INDEX IF NOT EXISTS "EventInterest_email_idx" ON "EventInterest"("email");
CREATE INDEX IF NOT EXISTS "EventInterest_createdAt_idx" ON "EventInterest"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventInterest_eventId_fkey'
  ) THEN
    ALTER TABLE "EventInterest"
      ADD CONSTRAINT "EventInterest_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) EventFolderScope + EventFolder (completo)
DO $$ BEGIN
  CREATE TYPE "EventFolderScope" AS ENUM ('ORGANIZER', 'PHOTOGRAPHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EventFolder" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "folderScope" "EventFolderScope" NOT NULL DEFAULT 'ORGANIZER',
    "createdByUserId" INTEGER,
    "ownerPhotographerId" INTEGER,
    "listedInPublicGallery" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFolder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventFolder" ADD COLUMN IF NOT EXISTS "parentId" INTEGER;
ALTER TABLE "EventFolder" ADD COLUMN IF NOT EXISTS "folderScope" "EventFolderScope" NOT NULL DEFAULT 'ORGANIZER';
ALTER TABLE "EventFolder" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;
ALTER TABLE "EventFolder" ADD COLUMN IF NOT EXISTS "ownerPhotographerId" INTEGER;
ALTER TABLE "EventFolder" ADD COLUMN IF NOT EXISTS "listedInPublicGallery" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "EventFolder_eventId_idx" ON "EventFolder"("eventId");
CREATE INDEX IF NOT EXISTS "EventFolder_eventId_sortOrder_idx" ON "EventFolder"("eventId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "EventFolder_eventId_slug_key" ON "EventFolder"("eventId", "slug");
CREATE INDEX IF NOT EXISTS "EventFolder_parentId_idx" ON "EventFolder"("parentId");
CREATE INDEX IF NOT EXISTS "EventFolder_eventId_folderScope_idx" ON "EventFolder"("eventId", "folderScope");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventFolder_eventId_fkey') THEN
    ALTER TABLE "EventFolder"
      ADD CONSTRAINT "EventFolder_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventFolder_parentId_fkey') THEN
    ALTER TABLE "EventFolder"
      ADD CONSTRAINT "EventFolder_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "EventFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventFolder_createdByUserId_fkey') THEN
    ALTER TABLE "EventFolder"
      ADD CONSTRAINT "EventFolder_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventFolder_ownerPhotographerId_fkey') THEN
    ALTER TABLE "EventFolder"
      ADD CONSTRAINT "EventFolder_ownerPhotographerId_fkey"
      FOREIGN KEY ("ownerPhotographerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Photo.eventFolderId (columna puede existir sin tabla/FK)
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "eventFolderId" INTEGER;
CREATE INDEX IF NOT EXISTS "Photo_eventFolderId_idx" ON "Photo"("eventFolderId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Photo_eventFolderId_fkey') THEN
    ALTER TABLE "Photo"
      ADD CONSTRAINT "Photo_eventFolderId_fkey"
      FOREIGN KEY ("eventFolderId") REFERENCES "EventFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
