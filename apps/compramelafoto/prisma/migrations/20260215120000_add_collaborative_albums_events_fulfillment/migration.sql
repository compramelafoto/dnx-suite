-- Álbumes colaborativos, eventos, organizadores y multi-fulfillment
-- Enums nuevos
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'BIRTHDAY', 'GRADUATION', 'SPORTS', 'CONCERT', 'CORPORATE', 'OTHER');
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');
CREATE TYPE "EventJoinPolicy" AS ENUM ('OPEN', 'REQUEST', 'INVITE_ONLY');
CREATE TYPE "EventMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "EventMemberRole" AS ENUM ('ORGANIZER', 'PHOTOGRAPHER');
CREATE TYPE "DeliveryType" AS ENUM ('PICKUP', 'SHIPPING');
CREATE TYPE "AlbumCollaboratorRole" AS ENUM ('COLLABORATOR');
CREATE TYPE "EventSimilarityStatus" AS ENUM ('SUGGESTED', 'MERGED_MANUALLY', 'REJECTED');

-- Role: agregar ORGANIZER
-- Role: agregar ORGANIZER
ALTER TYPE "Role" ADD VALUE 'ORGANIZER';

-- User: postalCode
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

-- Album: campos colaborativos y geo
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "creatorId" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "eventId" INTEGER;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "type" "EventType";
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "geohash" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "deliveryType" "DeliveryType";

-- Event
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "locationName" TEXT,
    "city" TEXT NOT NULL,
    "geohash" TEXT,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "joinPolicy" "EventJoinPolicy" NOT NULL DEFAULT 'OPEN',
    "maxPhotographers" INTEGER,
    "creatorId" INTEGER NOT NULL,
    "promoCommitment" BOOLEAN NOT NULL DEFAULT false,
    "promoText" TEXT,
    "mergedIntoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- EventMember
CREATE TABLE "EventMember" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "EventMemberRole" NOT NULL,
    "status" "EventMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("id")
);

-- EventSimilarity
CREATE TABLE "EventSimilarity" (
    "id" SERIAL NOT NULL,
    "eventAId" INTEGER NOT NULL,
    "eventBId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "EventSimilarityStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSimilarity_pkey" PRIMARY KEY ("id")
);

-- OrganizerDownloadAllowance
CREATE TABLE "OrganizerDownloadAllowance" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "usedDownloads" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerDownloadAllowance_pkey" PRIMARY KEY ("id")
);

-- DashboardNotification
CREATE TABLE "DashboardNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardNotification_pkey" PRIMARY KEY ("id")
);

-- AlbumCollaborator
CREATE TABLE "AlbumCollaborator" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "AlbumCollaboratorRole" NOT NULL DEFAULT 'COLLABORATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumCollaborator_pkey" PRIMARY KEY ("id")
);

-- AlbumSlugAlias
CREATE TABLE "AlbumSlugAlias" (
    "id" SERIAL NOT NULL,
    "aliasSlug" TEXT NOT NULL,
    "targetAlbumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumSlugAlias_pkey" PRIMARY KEY ("id")
);

-- OrderFulfillmentGroup
CREATE TABLE "OrderFulfillmentGroup" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photographerId" INTEGER NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'PICKUP',
    "pickupAddress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFulfillmentGroup_pkey" PRIMARY KEY ("id")
);

-- OrderItem: fulfillmentGroupId
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "fulfillmentGroupId" INTEGER;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "EventMember_eventId_userId_key" ON "EventMember"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "Event_creatorId_idx" ON "Event"("creatorId");
CREATE INDEX IF NOT EXISTS "Event_city_idx" ON "Event"("city");
CREATE INDEX IF NOT EXISTS "Event_geohash_idx" ON "Event"("geohash");
CREATE INDEX IF NOT EXISTS "Event_startsAt_idx" ON "Event"("startsAt");
CREATE INDEX IF NOT EXISTS "Event_mergedIntoId_idx" ON "Event"("mergedIntoId");

CREATE INDEX IF NOT EXISTS "EventMember_eventId_idx" ON "EventMember"("eventId");
CREATE INDEX IF NOT EXISTS "EventMember_userId_idx" ON "EventMember"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "EventSimilarity_eventAId_eventBId_key" ON "EventSimilarity"("eventAId", "eventBId");
CREATE INDEX IF NOT EXISTS "EventSimilarity_status_idx" ON "EventSimilarity"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizerDownloadAllowance_eventId_photographerId_key" ON "OrganizerDownloadAllowance"("eventId", "photographerId");
CREATE INDEX IF NOT EXISTS "OrganizerDownloadAllowance_eventId_idx" ON "OrganizerDownloadAllowance"("eventId");
CREATE INDEX IF NOT EXISTS "OrganizerDownloadAllowance_photographerId_idx" ON "OrganizerDownloadAllowance"("photographerId");

CREATE INDEX IF NOT EXISTS "DashboardNotification_userId_idx" ON "DashboardNotification"("userId");
CREATE INDEX IF NOT EXISTS "DashboardNotification_readAt_idx" ON "DashboardNotification"("readAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AlbumCollaborator_albumId_userId_key" ON "AlbumCollaborator"("albumId", "userId");
CREATE INDEX IF NOT EXISTS "AlbumCollaborator_albumId_idx" ON "AlbumCollaborator"("albumId");
CREATE INDEX IF NOT EXISTS "AlbumCollaborator_userId_idx" ON "AlbumCollaborator"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "AlbumSlugAlias_aliasSlug_key" ON "AlbumSlugAlias"("aliasSlug");
CREATE INDEX IF NOT EXISTS "AlbumSlugAlias_aliasSlug_idx" ON "AlbumSlugAlias"("aliasSlug");
CREATE INDEX IF NOT EXISTS "AlbumSlugAlias_targetAlbumId_idx" ON "AlbumSlugAlias"("targetAlbumId");

CREATE INDEX IF NOT EXISTS "OrderFulfillmentGroup_orderId_idx" ON "OrderFulfillmentGroup"("orderId");
CREATE INDEX IF NOT EXISTS "OrderFulfillmentGroup_photographerId_idx" ON "OrderFulfillmentGroup"("photographerId");

CREATE INDEX IF NOT EXISTS "Album_creatorId_idx" ON "Album"("creatorId");
CREATE INDEX IF NOT EXISTS "Album_eventId_idx" ON "Album"("eventId");
CREATE INDEX IF NOT EXISTS "Album_geohash_idx" ON "Album"("geohash");

CREATE INDEX IF NOT EXISTS "OrderItem_fulfillmentGroupId_idx" ON "OrderItem"("fulfillmentGroupId");

-- FKs
ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventSimilarity" ADD CONSTRAINT "EventSimilarity_eventAId_fkey" FOREIGN KEY ("eventAId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSimilarity" ADD CONSTRAINT "EventSimilarity_eventBId_fkey" FOREIGN KEY ("eventBId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizerDownloadAllowance" ADD CONSTRAINT "OrganizerDownloadAllowance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizerDownloadAllowance" ADD CONSTRAINT "OrganizerDownloadAllowance_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DashboardNotification" ADD CONSTRAINT "DashboardNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlbumCollaborator" ADD CONSTRAINT "AlbumCollaborator_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumCollaborator" ADD CONSTRAINT "AlbumCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlbumSlugAlias" ADD CONSTRAINT "AlbumSlugAlias_targetAlbumId_fkey" FOREIGN KEY ("targetAlbumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderFulfillmentGroup" ADD CONSTRAINT "OrderFulfillmentGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderFulfillmentGroup" ADD CONSTRAINT "OrderFulfillmentGroup_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Album" ADD CONSTRAINT "Album_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Album" ADD CONSTRAINT "Album_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_fulfillmentGroupId_fkey" FOREIGN KEY ("fulfillmentGroupId") REFERENCES "OrderFulfillmentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
