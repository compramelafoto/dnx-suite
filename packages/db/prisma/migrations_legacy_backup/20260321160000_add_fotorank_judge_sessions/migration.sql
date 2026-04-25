-- CreateTable
CREATE TABLE "FotorankJudgeSession" (
    "id" TEXT NOT NULL,
    "judgeAccountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotorankJudgeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotorankJudgeSession_tokenHash_key" ON "FotorankJudgeSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankJudgeSession_judgeAccountId_idx" ON "FotorankJudgeSession"("judgeAccountId");

-- CreateIndex
CREATE INDEX "FotorankJudgeSession_expiresAt_idx" ON "FotorankJudgeSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "FotorankJudgeSession" ADD CONSTRAINT "FotorankJudgeSession_judgeAccountId_fkey" FOREIGN KEY ("judgeAccountId") REFERENCES "FotorankJudgeAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
