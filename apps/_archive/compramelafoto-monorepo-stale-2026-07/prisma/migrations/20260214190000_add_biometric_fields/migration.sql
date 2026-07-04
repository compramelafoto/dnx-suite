-- AlterTable: Add biometric fields to AlbumInterest
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "biometricConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "biometricConsentAt" TIMESTAMP(3);
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "biometricDeletedAt" TIMESTAMP(3);
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "selfieKey" TEXT;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "faceId" TEXT;
ALTER TABLE "AlbumInterest" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateIndex: Add indexes for biometric fields
CREATE INDEX IF NOT EXISTS "AlbumInterest_faceId_idx" ON "AlbumInterest"("faceId");
CREATE INDEX IF NOT EXISTS "AlbumInterest_expiresAt_idx" ON "AlbumInterest"("expiresAt");
CREATE INDEX IF NOT EXISTS "AlbumInterest_biometricDeletedAt_idx" ON "AlbumInterest"("biometricDeletedAt");

-- CreateUniqueConstraint: Make selfieKey and faceId unique
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumInterest_selfieKey_key" ON "AlbumInterest"("selfieKey") WHERE "selfieKey" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumInterest_faceId_key" ON "AlbumInterest"("faceId") WHERE "faceId" IS NOT NULL;

-- CreateTable: FaceMatchEvent
CREATE TABLE IF NOT EXISTS "FaceMatchEvent" (
    "id" SERIAL NOT NULL,
    "albumInterestId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "faceDetectionId" INTEGER,
    "similarity" DOUBLE PRECISION NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Add indexes for FaceMatchEvent
CREATE INDEX IF NOT EXISTS "FaceMatchEvent_albumInterestId_idx" ON "FaceMatchEvent"("albumInterestId");
CREATE INDEX IF NOT EXISTS "FaceMatchEvent_photoId_idx" ON "FaceMatchEvent"("photoId");
CREATE INDEX IF NOT EXISTS "FaceMatchEvent_notifiedAt_idx" ON "FaceMatchEvent"("notifiedAt");
CREATE INDEX IF NOT EXISTS "FaceMatchEvent_createdAt_idx" ON "FaceMatchEvent"("createdAt");

-- AddForeignKey: FaceMatchEvent -> AlbumInterest
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_albumInterestId_fkey" FOREIGN KEY ("albumInterestId") REFERENCES "AlbumInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FaceMatchEvent -> Photo
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FaceMatchEvent -> FaceDetection
ALTER TABLE "FaceMatchEvent" ADD CONSTRAINT "FaceMatchEvent_faceDetectionId_fkey" FOREIGN KEY ("faceDetectionId") REFERENCES "FaceDetection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
