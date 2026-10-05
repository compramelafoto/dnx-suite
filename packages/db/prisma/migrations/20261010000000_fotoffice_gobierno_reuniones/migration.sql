-- CreateTable
CREATE TABLE "GovVote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "voterUserId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMeeting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "heldAt" TIMESTAMP(3),
    "minutesApprovedAt" TIMESTAMP(3),
    "minutesApprovedByUserId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "memberId" TEXT,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "officeName" TEXT,

    CONSTRAINT "GovMeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMeetingItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "decisionText" TEXT,
    "outcome" TEXT,
    "voteSnapshot" JSONB,
    "treatedAt" TIMESTAMP(3),
    "treatedByUserId" INTEGER,

    CONSTRAINT "GovMeetingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovMeetingNote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "authorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovMeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GovVote_projectId_voterUserId_key" ON "GovVote"("projectId", "voterUserId");

-- CreateIndex
CREATE INDEX "GovMeeting_workspaceId_scheduledAt_idx" ON "GovMeeting"("workspaceId", "scheduledAt");

-- CreateIndex
CREATE INDEX "GovMeetingAttendee_meetingId_idx" ON "GovMeetingAttendee"("meetingId");

-- CreateIndex
CREATE INDEX "GovMeetingItem_meetingId_order_idx" ON "GovMeetingItem"("meetingId", "order");

-- CreateIndex
CREATE INDEX "GovMeetingItem_projectId_idx" ON "GovMeetingItem"("projectId");

-- CreateIndex
CREATE INDEX "GovMeetingNote_meetingId_createdAt_idx" ON "GovMeetingNote"("meetingId", "createdAt");

-- AddForeignKey
ALTER TABLE "GovVote" ADD CONSTRAINT "GovVote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMeeting" ADD CONSTRAINT "GovMeeting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMeetingAttendee" ADD CONSTRAINT "GovMeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMeetingItem" ADD CONSTRAINT "GovMeetingItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMeetingItem" ADD CONSTRAINT "GovMeetingItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GovProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovMeetingNote" ADD CONSTRAINT "GovMeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

