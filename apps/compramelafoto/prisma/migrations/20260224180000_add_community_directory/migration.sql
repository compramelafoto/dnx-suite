-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CommunityProfileType" AS ENUM ('PHOTOGRAPHER_SERVICE', 'EVENT_VENDOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityProfileStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunitySubmissionStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable CommunityProfile
CREATE TABLE IF NOT EXISTS "CommunityProfile" (
  "id" TEXT NOT NULL,
  "type" "CommunityProfileType" NOT NULL,
  "status" "CommunityProfileStatus" NOT NULL DEFAULT 'PENDING',
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "province" TEXT,
  "city" TEXT,
  "address" TEXT,
  "email" TEXT,
  "emailNormalized" TEXT,
  "whatsapp" TEXT,
  "whatsappNormalized" TEXT,
  "website" TEXT,
  "instagram" TEXT,
  "facebook" TEXT,
  "tiktok" TEXT,
  "youtube" TEXT,
  "logoUrl" TEXT,
  "contactName" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityProfile_type_slug_key" ON "CommunityProfile"("type", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityProfile_type_emailNormalized_key" ON "CommunityProfile"("type", "emailNormalized");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityProfile_type_whatsappNormalized_key" ON "CommunityProfile"("type", "whatsappNormalized");
CREATE INDEX IF NOT EXISTS "CommunityProfile_type_status_idx" ON "CommunityProfile"("type", "status");
CREATE INDEX IF NOT EXISTS "CommunityProfile_type_province_idx" ON "CommunityProfile"("type", "province");
CREATE INDEX IF NOT EXISTS "CommunityProfile_type_city_idx" ON "CommunityProfile"("type", "city");
CREATE INDEX IF NOT EXISTS "CommunityProfile_province_city_idx" ON "CommunityProfile"("province", "city");

-- CreateTable CommunityCategory
CREATE TABLE IF NOT EXISTS "CommunityCategory" (
  "id" SERIAL NOT NULL,
  "type" "CommunityProfileType" NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "CommunityCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityCategory_type_slug_key" ON "CommunityCategory"("type", "slug");

-- CreateTable CommunityProfileCategory
CREATE TABLE IF NOT EXISTS "CommunityProfileCategory" (
  "profileId" TEXT NOT NULL,
  "categoryId" INTEGER NOT NULL,

  CONSTRAINT "CommunityProfileCategory_pkey" PRIMARY KEY ("profileId", "categoryId")
);

ALTER TABLE "CommunityProfileCategory" DROP CONSTRAINT IF EXISTS "CommunityProfileCategory_profileId_fkey";
ALTER TABLE "CommunityProfileCategory" ADD CONSTRAINT "CommunityProfileCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityProfileCategory" DROP CONSTRAINT IF EXISTS "CommunityProfileCategory_categoryId_fkey";
ALTER TABLE "CommunityProfileCategory" ADD CONSTRAINT "CommunityProfileCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunityCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable CommunityWorkReference
CREATE TABLE IF NOT EXISTS "CommunityWorkReference" (
  "id" SERIAL NOT NULL,
  "profileId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunityWorkReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunityWorkReference_profileId_idx" ON "CommunityWorkReference"("profileId");
ALTER TABLE "CommunityWorkReference" DROP CONSTRAINT IF EXISTS "CommunityWorkReference_profileId_fkey";
ALTER TABLE "CommunityWorkReference" ADD CONSTRAINT "CommunityWorkReference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommunityProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable CommunitySubmission
CREATE TABLE IF NOT EXISTS "CommunitySubmission" (
  "id" SERIAL NOT NULL,
  "type" "CommunityProfileType" NOT NULL,
  "status" "CommunitySubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "matchedProfileId" TEXT,
  "conflictProfileIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunitySubmission_pkey" PRIMARY KEY ("id")
);
