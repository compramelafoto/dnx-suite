-- AlterTable FotofficeWorkspaceBranding (onboarding / business profile)
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "activityType" TEXT;
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "province" TEXT;
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- CreateTable FotofficePhotographerProfile
CREATE TABLE IF NOT EXISTS "FotofficePhotographerProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePhotographerProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePhotographerProfile_userId_key" ON "FotofficePhotographerProfile"("userId");

DO $$ BEGIN
  ALTER TABLE "FotofficePhotographerProfile"
    ADD CONSTRAINT "FotofficePhotographerProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
