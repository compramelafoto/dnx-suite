-- Etapa 22R-B: perfiles públicos múltiples + preferencias Info Spot (SAFE_ADDITIVE).

CREATE TYPE "DnxPublicProfileType" AS ENUM ('CUSTOMER', 'PHOTOGRAPHER', 'ORGANIZER');
CREATE TYPE "DnxPublicProfileStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');
CREATE TYPE "DnxPublicProfileSource" AS ENUM ('SELF_SELECTED', 'CLF_EXISTING', 'ADMIN_ASSIGNED');

CREATE TABLE "DnxUserProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "profileType" "DnxPublicProfileType" NOT NULL,
    "status" "DnxPublicProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "DnxPublicProfileSource" NOT NULL DEFAULT 'SELF_SELECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DnxUserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InfoSpotUserPreferences" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "city" TEXT,
    "province" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusKm" INTEGER,
    "interestCategorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notifyEventsNearby" BOOLEAN NOT NULL DEFAULT false,
    "notifyCategories" BOOLEAN NOT NULL DEFAULT false,
    "notifyCalls" BOOLEAN NOT NULL DEFAULT false,
    "geoConsentAt" TIMESTAMP(3),
    "notificationsConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoSpotUserPreferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DnxUserProfile_userId_profileType_key" ON "DnxUserProfile"("userId", "profileType");
CREATE INDEX "DnxUserProfile_profileType_status_idx" ON "DnxUserProfile"("profileType", "status");
CREATE INDEX "DnxUserProfile_userId_status_idx" ON "DnxUserProfile"("userId", "status");

CREATE UNIQUE INDEX "InfoSpotUserPreferences_userId_key" ON "InfoSpotUserPreferences"("userId");

ALTER TABLE "DnxUserProfile" ADD CONSTRAINT "DnxUserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfoSpotUserPreferences" ADD CONSTRAINT "InfoSpotUserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
