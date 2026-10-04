-- Cursos grabados: modalidad del curso y sus clases.
--
-- `Course.deliveryMode` nace en PRESENCIAL para que ningún curso existente cambie de
-- comportamiento. `CourseEnrollment.courseInstanceId` pasa a opcional porque un curso grabado
-- no tiene ediciones; la regla "presencial exige edición, grabado no la admite" se valida en
-- la aplicación (lib/presential-courses/delivery-mode.ts), con test.

CREATE TYPE "CourseDeliveryMode" AS ENUM ('PRESENCIAL', 'LIVE', 'RECORDED');
CREATE TYPE "CourseLessonVideoStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'ERROR');

ALTER TABLE "Course" ADD COLUMN "deliveryMode" "CourseDeliveryMode" NOT NULL DEFAULT 'PRESENCIAL';
ALTER TABLE "Course" ADD COLUMN "priceArs" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN "accessMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Course" ADD COLUMN "completionPercent" INTEGER NOT NULL DEFAULT 80;

ALTER TABLE "CourseEnrollment" ALTER COLUMN "courseInstanceId" DROP NOT NULL;

CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "videoProvider" TEXT NOT NULL DEFAULT 'cloudflare_stream',
    "videoUid" TEXT,
    "videoStatus" "CourseLessonVideoStatus" NOT NULL DEFAULT 'PENDING',
    "thumbnailUrl" TEXT,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseLesson_courseId_sortOrder_idx" ON "CourseLesson"("courseId", "sortOrder");
CREATE UNIQUE INDEX "CourseLesson_videoUid_key" ON "CourseLesson"("videoUid");

ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseLessonAttachment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseLessonAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseLessonAttachment_lessonId_idx" ON "CourseLessonAttachment"("lessonId");

ALTER TABLE "CourseLessonAttachment" ADD CONSTRAINT "CourseLessonAttachment_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
