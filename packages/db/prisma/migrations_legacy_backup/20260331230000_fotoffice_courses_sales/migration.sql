-- Fotoffice: módulo venta de cursos (courses-sales), branding público y leads

CREATE TYPE "CourseSalesModality" AS ENUM ('LIVE', 'RECORDED', 'HYBRID');
CREATE TYPE "CourseSalesLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "CourseSalesCourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');
CREATE TYPE "CourseSalesLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

CREATE TABLE "WorkspaceFeatureModule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceFeatureModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceFeatureModule_workspaceId_moduleKey_key" ON "WorkspaceFeatureModule"("workspaceId", "moduleKey");
CREATE INDEX "WorkspaceFeatureModule_moduleKey_idx" ON "WorkspaceFeatureModule"("moduleKey");

CREATE TABLE "FotofficeWorkspaceBranding" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWorkspaceBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotofficeWorkspaceBranding_workspaceId_key" ON "FotofficeWorkspaceBranding"("workspaceId");
CREATE UNIQUE INDEX "FotofficeWorkspaceBranding_publicSlug_key" ON "FotofficeWorkspaceBranding"("publicSlug");

CREATE TABLE "CourseSalesWorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "enrollmentCtaLabel" TEXT DEFAULT 'Quiero inscribirme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesWorkspaceSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseSalesWorkspaceSettings_workspaceId_key" ON "CourseSalesWorkspaceSettings"("workspaceId");

CREATE TABLE "CourseSalesTeacher" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "shortBio" TEXT,
    "longBio" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "specialty" TEXT,
    "experienceYears" INTEGER,
    "city" TEXT,
    "country" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesTeacher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseSalesTeacher_workspaceId_slug_key" ON "CourseSalesTeacher"("workspaceId", "slug");
CREATE INDEX "CourseSalesTeacher_workspaceId_idx" ON "CourseSalesTeacher"("workspaceId");

CREATE TABLE "CourseSalesCourse" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "modality" "CourseSalesModality" NOT NULL,
    "level" "CourseSalesLevel" NOT NULL,
    "category" TEXT,
    "targetAudience" TEXT,
    "prerequisites" TEXT,
    "objectives" TEXT,
    "durationText" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "scheduleText" TEXT,
    "seats" INTEGER,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "discountPrice" DECIMAL(12,2),
    "includesCertificate" BOOLEAN NOT NULL DEFAULT false,
    "includesRecordings" BOOLEAN NOT NULL DEFAULT false,
    "includesDownloadables" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CourseSalesCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "landingBlocksJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseSalesCourse_workspaceId_slug_key" ON "CourseSalesCourse"("workspaceId", "slug");
CREATE INDEX "CourseSalesCourse_workspaceId_idx" ON "CourseSalesCourse"("workspaceId");
CREATE INDEX "CourseSalesCourse_teacherId_idx" ON "CourseSalesCourse"("teacherId");

CREATE TABLE "CourseSalesSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseSalesSection_courseId_idx" ON "CourseSalesSection"("courseId");

CREATE TABLE "CourseSalesLesson" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesLesson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseSalesLesson_sectionId_idx" ON "CourseSalesLesson"("sectionId");

CREATE TABLE "CourseSalesLead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" "CourseSalesLeadStatus" NOT NULL DEFAULT 'NEW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSalesLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseSalesLead_workspaceId_idx" ON "CourseSalesLead"("workspaceId");
CREATE INDEX "CourseSalesLead_courseId_idx" ON "CourseSalesLead"("courseId");

ALTER TABLE "WorkspaceFeatureModule" ADD CONSTRAINT "WorkspaceFeatureModule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeWorkspaceBranding" ADD CONSTRAINT "FotofficeWorkspaceBranding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesWorkspaceSettings" ADD CONSTRAINT "CourseSalesWorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesTeacher" ADD CONSTRAINT "CourseSalesTeacher_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesCourse" ADD CONSTRAINT "CourseSalesCourse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesCourse" ADD CONSTRAINT "CourseSalesCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CourseSalesTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseSalesSection" ADD CONSTRAINT "CourseSalesSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseSalesCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesLesson" ADD CONSTRAINT "CourseSalesLesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSalesSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesLead" ADD CONSTRAINT "CourseSalesLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseSalesLead" ADD CONSTRAINT "CourseSalesLead_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "CourseSalesCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
