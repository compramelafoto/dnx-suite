-- Clickatón admin: ediciones y sedes (Etapa 10C).
-- Additive only: CREATE TYPE / TABLE / INDEX / CONSTRAINT.
-- No DROP, TRUNCATE, DELETE, or destructive changes.
-- Do not apply to Neon shared / Production without explicit authorization.

CREATE TYPE "ClickatonEditionStatus" AS ENUM (
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "ClickatonEdition" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "shortDescription" TEXT,
  "description" TEXT,
  "status" "ClickatonEditionStatus" NOT NULL DEFAULT 'DRAFT',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "registrationOpenAt" TIMESTAMP(3),
  "registrationCloseAt" TIMESTAMP(3),
  "defaultCapacity" INTEGER,
  "fotorankContestId" TEXT,
  "coverImageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonEdition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonEdition_slug_key" ON "ClickatonEdition"("slug");
CREATE INDEX "ClickatonEdition_status_idx" ON "ClickatonEdition"("status");
CREATE INDEX "ClickatonEdition_isPublished_idx" ON "ClickatonEdition"("isPublished");
CREATE INDEX "ClickatonEdition_startAt_idx" ON "ClickatonEdition"("startAt");
CREATE INDEX "ClickatonEdition_fotorankContestId_idx" ON "ClickatonEdition"("fotorankContestId");

CREATE TABLE "ClickatonVenue" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "provinceOrState" TEXT,
  "country" TEXT NOT NULL DEFAULT 'AR',
  "address" TEXT,
  "meetingPoint" TEXT,
  "capacity" INTEGER,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClickatonVenue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClickatonVenue_editionId_slug_key" ON "ClickatonVenue"("editionId", "slug");
CREATE INDEX "ClickatonVenue_editionId_idx" ON "ClickatonVenue"("editionId");
CREATE INDEX "ClickatonVenue_city_idx" ON "ClickatonVenue"("city");
CREATE INDEX "ClickatonVenue_isActive_idx" ON "ClickatonVenue"("isActive");

ALTER TABLE "ClickatonVenue"
  ADD CONSTRAINT "ClickatonVenue_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "ClickatonEdition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
