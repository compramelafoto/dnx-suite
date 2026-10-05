-- CreateEnum
CREATE TYPE "CourseResaleAgreementStatus" AS ENUM ('PENDIENTE', 'ACTIVO', 'PAUSADO', 'RECHAZADO', 'TERMINADO');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "offeredToResellers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedResellerBps" INTEGER;

-- AlterTable
ALTER TABLE "CourseEnrollment" ADD COLUMN     "resaleAgreementId" TEXT;

-- CreateTable
CREATE TABLE "CourseResaleAgreement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "resellerWorkspaceId" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "memberDiscountBps" INTEGER NOT NULL DEFAULT 0,
    "status" "CourseResaleAgreementStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedByUserId" INTEGER,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "pausedByWorkspaceId" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResaleAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrollment_resaleAgreementId_idx" ON "CourseEnrollment"("resaleAgreementId");

-- CreateIndex
CREATE INDEX "CourseResaleAgreement_resellerWorkspaceId_status_idx" ON "CourseResaleAgreement"("resellerWorkspaceId", "status");

-- CreateIndex
CREATE INDEX "CourseResaleAgreement_courseId_status_idx" ON "CourseResaleAgreement"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResaleAgreement_courseId_resellerWorkspaceId_key" ON "CourseResaleAgreement"("courseId", "resellerWorkspaceId");

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_resaleAgreementId_fkey" FOREIGN KEY ("resaleAgreementId") REFERENCES "CourseResaleAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResaleAgreement" ADD CONSTRAINT "CourseResaleAgreement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResaleAgreement" ADD CONSTRAINT "CourseResaleAgreement_resellerWorkspaceId_fkey" FOREIGN KEY ("resellerWorkspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
