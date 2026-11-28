-- Preventa escolar (CLF): quién elige las fotos del pack (la familia, el fotógrafo o la familia con plazo).
-- Sólo tablas nuevas: se aplica en la base de CLF; las demás bases no las usan.
CREATE TABLE IF NOT EXISTS "SchoolPhotoChooserSetting" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'FAMILY',
    "familyDays" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolPhotoChooserSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPhotoChooserSetting_albumId_key" ON "SchoolPhotoChooserSetting"("albumId");

CREATE TABLE IF NOT EXISTS "SchoolPhotoChosenByPhotographer" (
    "id" SERIAL NOT NULL,
    "preventaOrderId" INTEGER NOT NULL,
    "redemptionOrderId" INTEGER NOT NULL,
    "photographerUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolPhotoChosenByPhotographer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPhotoChosenByPhotographer_preventaOrderId_key" ON "SchoolPhotoChosenByPhotographer"("preventaOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPhotoChosenByPhotographer_redemptionOrderId_key" ON "SchoolPhotoChosenByPhotographer"("redemptionOrderId");

CREATE TABLE IF NOT EXISTS "SchoolCourseGroupPhoto" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "courseKey" TEXT NOT NULL,
    "photoId" INTEGER NOT NULL,
    "chosenByUserId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolCourseGroupPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCourseGroupPhoto_albumId_courseKey_key" ON "SchoolCourseGroupPhoto"("albumId", "courseKey");
