-- CreateEnum
CREATE TYPE "CourseBeneficiaryRole" AS ENUM ('DOCENTE', 'PRODUCTOR', 'INSTITUCION', 'OTRO');

-- CreateEnum
CREATE TYPE "CourseBeneficiaryStatus" AS ENUM ('INVITADO', 'ACEPTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "CourseSaleShareKind" AS ENUM ('PLATAFORMA', 'REVENDEDOR', 'BENEFICIARIO');

-- AlterTable
ALTER TABLE "CourseEnrollment" ADD COLUMN     "discountArs" DECIMAL(12,2),
ADD COLUMN     "listPriceArs" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CourseBeneficiary" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "invitedEmail" TEXT,
    "role" "CourseBeneficiaryRole" NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "absorbsProcessorFee" BOOLEAN NOT NULL DEFAULT false,
    "status" "CourseBeneficiaryStatus" NOT NULL DEFAULT 'INVITADO',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseBeneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSaleShare" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "kind" "CourseSaleShareKind" NOT NULL,
    "label" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "absorbsProcessorFee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseSaleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseBeneficiary_workspaceId_status_idx" ON "CourseBeneficiary"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CourseBeneficiary_invitedEmail_idx" ON "CourseBeneficiary"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBeneficiary_courseId_workspaceId_key" ON "CourseBeneficiary"("courseId", "workspaceId");

-- CreateIndex
CREATE INDEX "CourseSaleShare_enrollmentId_idx" ON "CourseSaleShare"("enrollmentId");

-- CreateIndex
CREATE INDEX "CourseSaleShare_workspaceId_idx" ON "CourseSaleShare"("workspaceId");

-- AddForeignKey
ALTER TABLE "CourseBeneficiary" ADD CONSTRAINT "CourseBeneficiary_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBeneficiary" ADD CONSTRAINT "CourseBeneficiary_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSaleShare" ADD CONSTRAINT "CourseSaleShare_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSaleShare" ADD CONSTRAINT "CourseSaleShare_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

