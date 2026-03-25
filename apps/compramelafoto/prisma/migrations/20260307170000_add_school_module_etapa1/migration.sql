-- CreateTable School
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable SchoolCourse
CREATE TABLE "SchoolCourse" (
    "id" SERIAL NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "division" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
CREATE INDEX "School_ownerId_idx" ON "School"("ownerId");
CREATE INDEX "SchoolCourse_schoolId_idx" ON "SchoolCourse"("schoolId");

-- Add foreign keys for School and SchoolCourse
ALTER TABLE "School" ADD CONSTRAINT "School_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolCourse" ADD CONSTRAINT "SchoolCourse_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add schoolId to Album
ALTER TABLE "Album" ADD COLUMN "schoolId" INTEGER;
ALTER TABLE "Album" ADD CONSTRAINT "Album_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Album_schoolId_idx" ON "Album"("schoolId");

-- Add columns to PreCompraOrder
ALTER TABLE "PreCompraOrder" ADD COLUMN "buyerName" TEXT;
ALTER TABLE "PreCompraOrder" ADD COLUMN "buyerPhone" TEXT;
ALTER TABLE "PreCompraOrder" ADD COLUMN "schoolCourseId" INTEGER;
ALTER TABLE "PreCompraOrder" ADD COLUMN "studentFirstName" TEXT;
ALTER TABLE "PreCompraOrder" ADD COLUMN "studentLastName" TEXT;
ALTER TABLE "PreCompraOrder" ADD COLUMN "mpPreferenceId" TEXT;
ALTER TABLE "PreCompraOrder" ADD COLUMN "mpInitPoint" TEXT;
ALTER TABLE "PreCompraOrder" ADD CONSTRAINT "PreCompraOrder_schoolCourseId_fkey" FOREIGN KEY ("schoolCourseId") REFERENCES "SchoolCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PreCompraOrder_schoolCourseId_idx" ON "PreCompraOrder"("schoolCourseId");

-- Add columns to Subject
ALTER TABLE "Subject" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Subject" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Subject" ADD COLUMN "schoolCourseId" INTEGER;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolCourseId_fkey" FOREIGN KEY ("schoolCourseId") REFERENCES "SchoolCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Subject_schoolCourseId_idx" ON "Subject"("schoolCourseId");
