-- CreateEnum
CREATE TYPE "FotorankJudgeAccountStatus" AS ENUM ('INVITED', 'PENDING_REGISTRATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FotorankJudgeMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FotorankJudgeInvitationStatus" AS ENUM ('DRAFT', 'SENT', 'OPENED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FotorankJudgeAssignmentType" AS ENUM ('PRIMARY', 'BACKUP');

-- CreateEnum
CREATE TYPE "FotorankJudgeAssignmentStatus" AS ENUM ('ASSIGNED', 'INVITATION_SENT', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'EXTENDED', 'REPLACED_BY_BACKUP');

-- CreateEnum
CREATE TYPE "FotorankJudgeMethodType" AS ENUM ('SCORE_1_5', 'SCORE_1_10', 'SCORE_0_100', 'YES_NO', 'FAVORITES_SELECTION', 'SELECTION_WITH_QUOTA', 'CRITERIA_BASED');

-- CreateEnum
CREATE TYPE "FotorankJudgeActorType" AS ENUM ('ADMIN', 'JUDGE', 'SYSTEM');

-- CreateTable
CREATE TABLE "FotorankJudgeAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountStatus" "FotorankJudgeAccountStatus" NOT NULL DEFAULT 'INVITED',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeProfile" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "shortBio" TEXT,
    "fullBioRichJson" JSONB,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "otherLinksJson" JSONB,
    "publicSlug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeOrganizationMembership" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipStatus" "FotorankJudgeMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeOrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT,
    "judgeAccountId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitationStatus" "FotorankJudgeInvitationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeAssignment" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignmentType" "FotorankJudgeAssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "assignmentStatus" "FotorankJudgeAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "evaluationStartsAt" TIMESTAMP(3),
    "evaluationEndsAt" TIMESTAMP(3),
    "extendedEndsAt" TIMESTAMP(3),
    "extensionReason" TEXT,
    "methodType" "FotorankJudgeMethodType" NOT NULL,
    "methodConfigJson" JSONB NOT NULL,
    "allowVoteEdit" BOOLEAN NOT NULL DEFAULT true,
    "commentsVisibleToParticipants" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankContestEntry" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeVote" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "valueNumeric" DOUBLE PRECISION,
    "valueBoolean" BOOLEAN,
    "isFavorite" BOOLEAN,
    "selectedRank" INTEGER,
    "criteriaScoresJson" JSONB,
    "comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankJudgeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeVoteHistory" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "previousPayloadJson" JSONB NOT NULL,
    "newPayloadJson" JSONB NOT NULL,
    "changedByJudgeId" TEXT,
    "changeReason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeVoteHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotorankJudgeAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contestId" TEXT,
    "actorType" "FotorankJudgeActorType" NOT NULL,
    "actorUserId" TEXT,
    "actorJudgeId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeAccount_email_key" ON "FotorankJudgeAccount"("email");

-- CreateIndex
CREATE INDEX "FotorankJudgeAccount_workspaceId_idx" ON "FotorankJudgeAccount"("workspaceId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAccount_accountStatus_idx" ON "FotorankJudgeAccount"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeProfile_judgeAccountId_key" ON "FotorankJudgeProfile"("judgeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeProfile_publicSlug_key" ON "FotorankJudgeProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "FotorankJudgeProfile_isPublic_idx" ON "FotorankJudgeProfile"("isPublic");

-- CreateIndex
CREATE INDEX "FotorankJudgeOrganizationMembership_organizationId_idx" ON "FotorankJudgeOrganizationMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeOrganizationMembership_judgeAccountId_organiza_key" ON "FotorankJudgeOrganizationMembership"("judgeAccountId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeInvitation_tokenHash_key" ON "FotorankJudgeInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_organizationId_invitationStatus_idx" ON "FotorankJudgeInvitation"("organizationId", "invitationStatus");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_contestId_idx" ON "FotorankJudgeInvitation"("contestId");

-- CreateIndex
CREATE INDEX "FotorankJudgeInvitation_email_idx" ON "FotorankJudgeInvitation"("email");

-- CreateIndex
CREATE INDEX "FotorankJudgeAssignment_contestId_categoryId_idx" ON "FotorankJudgeAssignment"("contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAssignment_judgeAccountId_assignmentStatus_idx" ON "FotorankJudgeAssignment"("judgeAccountId", "assignmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeAssignment_judgeAccountId_contestId_categoryId_key" ON "FotorankJudgeAssignment"("judgeAccountId", "contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankContestEntry_contestId_categoryId_idx" ON "FotorankContestEntry"("contestId", "categoryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVote_entryId_idx" ON "FotorankJudgeVote"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeVote_assignmentId_entryId_key" ON "FotorankJudgeVote"("assignmentId", "entryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_assignmentId_idx" ON "FotorankJudgeVoteHistory"("assignmentId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_entryId_idx" ON "FotorankJudgeVoteHistory"("entryId");

-- CreateIndex
CREATE INDEX "FotorankJudgeVoteHistory_changedAt_idx" ON "FotorankJudgeVoteHistory"("changedAt");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_organizationId_createdAt_idx" ON "FotorankJudgeAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_contestId_idx" ON "FotorankJudgeAuditEvent"("contestId");

-- CreateIndex
CREATE INDEX "FotorankJudgeAuditEvent_entityType_entityId_idx" ON "FotorankJudgeAuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "FotorankJudgeAccount" ADD CONSTRAINT "FotorankJudgeAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeProfile" ADD CONSTRAINT "FotorankJudgeProfile_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeOrganizationMembership" ADD CONSTRAINT "FotorankJudgeOrganizationMembership_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeOrganizationMembership" ADD CONSTRAINT "FotorankJudgeOrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeInvitation" ADD CONSTRAINT "FotorankJudgeInvitation_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAssignment" ADD CONSTRAINT "FotorankJudgeAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankContestEntry" ADD CONSTRAINT "FotorankContestEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FotorankContestCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVote" ADD CONSTRAINT "FotorankJudgeVote_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "FotorankJudgeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVote" ADD CONSTRAINT "FotorankJudgeVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FotorankContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVoteHistory" ADD CONSTRAINT "FotorankJudgeVoteHistory_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "FotorankJudgeVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeVoteHistory" ADD CONSTRAINT "FotorankJudgeVoteHistory_changedByJudgeId_fkey" FOREIGN KEY ("changedByJudgeId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ContestOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "FotorankContest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotorankJudgeAuditEvent" ADD CONSTRAINT "FotorankJudgeAuditEvent_actorJudgeId_fkey" FOREIGN KEY ("actorJudgeId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
