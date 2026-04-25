-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UPCOMING', 'HIDDEN');

-- CreateEnum
CREATE TYPE "CourseInstanceStatus" AS ENUM ('ACTIVE', 'FULL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseEnrollmentPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseEnrollmentPaymentMethod" AS ENUM ('MERCADO_PAGO');

-- AlterTable
ALTER TABLE "CourseSalesWorkspaceSettings"
ADD COLUMN "coursesFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "coverImageUrl" TEXT,
    "thumbnailImageUrl" TEXT,
    "instructorName" TEXT,
    "level" TEXT,
    "faqJson" JSONB,
    "classroomLink" TEXT,
    "classroomCode" TEXT,
    "classroomInstructions" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseInstance" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationAddress" TEXT,
    "priceArs" DECIMAL(12,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "CourseInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "courseInstanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "city" TEXT,
    "instagram" TEXT,
    "paymentStatus" "CourseEnrollmentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "CourseEnrollmentPaymentMethod" NOT NULL DEFAULT 'MERCADO_PAGO',
    "paymentProvider" "CourseEnrollmentPaymentMethod" NOT NULL DEFAULT 'MERCADO_PAGO',
    "paymentRef" TEXT,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "platformFeePercent" DECIMAL(5,2) NOT NULL,
    "platformFeeArs" DECIMAL(12,2) NOT NULL,
    "netAmountArs" DECIMAL(12,2) NOT NULL,
    "classroomAccessShownAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_workspaceId_slug_key" ON "Course"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Course_workspaceId_status_idx" ON "Course"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CourseInstance_courseId_status_idx" ON "CourseInstance"("courseId", "status");

-- CreateIndex
CREATE INDEX "CourseEnrollment_workspaceId_paymentStatus_idx" ON "CourseEnrollment"("workspaceId", "paymentStatus");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_paymentStatus_idx" ON "CourseEnrollment"("courseId", "paymentStatus");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseInstanceId_paymentStatus_idx" ON "CourseEnrollment"("courseInstanceId", "paymentStatus");

-- CreateIndex
CREATE INDEX "CourseEnrollment_paymentRef_idx" ON "CourseEnrollment"("paymentRef");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInstance" ADD CONSTRAINT "CourseInstance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseInstanceId_fkey" FOREIGN KEY ("courseInstanceId") REFERENCES "CourseInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
