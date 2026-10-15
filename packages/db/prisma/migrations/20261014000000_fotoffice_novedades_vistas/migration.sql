-- CreateTable
CREATE TABLE "MemberNotificationSeen" (
    "memberId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberNotificationSeen_pkey" PRIMARY KEY ("memberId")
);

-- AddForeignKey
ALTER TABLE "MemberNotificationSeen" ADD CONSTRAINT "MemberNotificationSeen_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

