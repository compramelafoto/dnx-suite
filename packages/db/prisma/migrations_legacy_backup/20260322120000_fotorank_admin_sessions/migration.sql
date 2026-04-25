-- CreateTable
CREATE TABLE "FotorankAdminSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotorankAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotorankAdminSession_tokenHash_key" ON "FotorankAdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FotorankAdminSession_userId_idx" ON "FotorankAdminSession"("userId");

-- CreateIndex
CREATE INDEX "FotorankAdminSession_expiresAt_idx" ON "FotorankAdminSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "FotorankAdminSession" ADD CONSTRAINT "FotorankAdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
