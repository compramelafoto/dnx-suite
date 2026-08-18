-- FotoRank ETAPA 10C — outbox transaccional con idempotencyKey única.
CREATE TABLE "FotorankTransactionalEmailOutbox" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "contestId" TEXT,
    "entryId" TEXT,
    "registrationId" TEXT,
    "toUserId" INTEGER,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "FotorankTransactionalEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotorankTransactionalEmailOutbox_idempotencyKey_key" ON "FotorankTransactionalEmailOutbox"("idempotencyKey");
CREATE INDEX "FotorankTransactionalEmailOutbox_entryId_kind_idx" ON "FotorankTransactionalEmailOutbox"("entryId", "kind");
CREATE INDEX "FotorankTransactionalEmailOutbox_status_createdAt_idx" ON "FotorankTransactionalEmailOutbox"("status", "createdAt");
CREATE INDEX "FotorankTransactionalEmailOutbox_contestId_createdAt_idx" ON "FotorankTransactionalEmailOutbox"("contestId", "createdAt");
