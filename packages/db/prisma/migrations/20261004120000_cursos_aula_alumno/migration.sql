-- CreateEnum
CREATE TYPE "CourseAccessOrigin" AS ENUM ('PURCHASE', 'MEMBER_BENEFIT');

-- AlterEnum
ALTER TYPE "CourseEnrollmentPaymentMethod" ADD VALUE 'MEMBER_BENEFIT';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "freeForMembers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CourseAccess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "origin" "CourseAccessOrigin" NOT NULL DEFAULT 'PURCHASE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLessonProgress" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "secondsWatched" INTEGER NOT NULL DEFAULT 0,
    "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastReportAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccess_enrollmentId_key" ON "CourseAccess"("enrollmentId");

-- CreateIndex
CREATE INDEX "CourseAccess_workspaceId_courseId_idx" ON "CourseAccess"("workspaceId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAccess_userId_courseId_key" ON "CourseAccess"("userId", "courseId");

-- CreateIndex
CREATE INDEX "CourseLessonProgress_lessonId_idx" ON "CourseLessonProgress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLessonProgress_accessId_lessonId_key" ON "CourseLessonProgress"("accessId", "lessonId");

-- AddForeignKey
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "CourseAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLessonProgress" ADD CONSTRAINT "CourseLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

