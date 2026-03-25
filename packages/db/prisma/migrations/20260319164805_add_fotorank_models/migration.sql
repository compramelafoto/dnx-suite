-- CreateEnum
CREATE TYPE "FotorankOrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'JUDGE', 'VIEWER');

-- CreateEnum
CREATE TYPE "FotorankMemberStatus" AS ENUM ('ACTIVE', 'PENDING', 'INVITED', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FotorankContestStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "FotorankContestVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateTable
CREATE TABLE "FotorankProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestOrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FotorankOrganizationRole" NOT NULL,
    "status" "FotorankMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestOrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "coverImageUrl" TEXT,
    "status" "FotorankContestStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "FotorankContestVisibility" NOT NULL DEFAULT 'PUBLIC',
    "rulesText" TEXT,
    "startAt" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "judgingStartAt" TIMESTAMP(3),
    "judgingEndAt" TIMESTAMP(3),
    "resultsAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestCategory" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "maxFiles" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotorankProfile_userId_key" ON "FotorankProfile"("userId");

-- CreateIndex
CREATE INDEX "FotorankProfile_userId_idx" ON "FotorankProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestOrganization_slug_key" ON "ContestOrganization"("slug");

-- CreateIndex
CREATE INDEX "ContestOrganization_slug_idx" ON "ContestOrganization"("slug");

-- CreateIndex
CREATE INDEX "ContestOrganization_createdByUserId_idx" ON "ContestOrganization"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContestOrganizationMember_organizationId_idx" ON "ContestOrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "ContestOrganizationMember_userId_idx" ON "ContestOrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestOrganizationMember_organizationId_userId_key" ON "ContestOrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "FotorankContest_organizationId_idx" ON "FotorankContest"("organizationId");

-- CreateIndex
CREATE INDEX "FotorankContest_status_idx" ON "FotorankContest"("status");

-- CreateIndex
CREATE INDEX "FotorankContest_createdByUserId_idx" ON "FotorankContest"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContest_organizationId_slug_key" ON "FotorankContest"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "FotorankContestCategory_contestId_idx" ON "FotorankContestCategory"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankContestCategory_contestId_slug_key" ON "FotorankContestCategory"("contestId", "slug");

-- AddForeignKey
ALTER TABLE "FotorankProfile" ADD CONSTRAINT "FotorankProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganization" ADD CONSTRAINT "ContestOrganization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestOrganizationMember" ADD CONSTRAINT "ContestOrganizationMember_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContest" ADD CONSTRAINT "FotorankContest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContest" ADD CONSTRAINT "FotorankContest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestCategory" ADD CONSTRAINT "FotorankContestCategory_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
