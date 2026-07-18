-- CreateEnum
CREATE TYPE "TeacherApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TeacherApplication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "experienceYears" INTEGER,
    "specialties" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "instagramUrl" TEXT,
    "cvUrl" TEXT NOT NULL,
    "profileImageUrl" TEXT NOT NULL,
    "status" "TeacherApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherApplication_workspaceId_status_idx" ON "TeacherApplication"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "TeacherApplication_workspaceId_createdAt_idx" ON "TeacherApplication"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherApplication_email_idx" ON "TeacherApplication"("email");

-- AddForeignKey
ALTER TABLE "TeacherApplication" ADD CONSTRAINT "TeacherApplication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
