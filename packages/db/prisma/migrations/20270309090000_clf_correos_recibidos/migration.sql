-- Correos recibidos en @compramelafoto.com (Resend Inbound) y sus respuestas desde el Admin.

CREATE TABLE IF NOT EXISTS "ClfInboundEmail" (
    "id" SERIAL NOT NULL,
    "resendId" TEXT NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "attachments" JSONB,
    "kind" TEXT NOT NULL DEFAULT 'NORMAL',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "ClfInboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClfInboundEmailReply" (
    "id" SERIAL NOT NULL,
    "inboundEmailId" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClfInboundEmailReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClfInboundEmail_resendId_key" ON "ClfInboundEmail"("resendId");
CREATE INDEX IF NOT EXISTS "ClfInboundEmail_receivedAt_idx" ON "ClfInboundEmail"("receivedAt");
CREATE INDEX IF NOT EXISTS "ClfInboundEmail_fromEmail_idx" ON "ClfInboundEmail"("fromEmail");
CREATE INDEX IF NOT EXISTS "ClfInboundEmail_archivedAt_receivedAt_idx" ON "ClfInboundEmail"("archivedAt", "receivedAt");
CREATE INDEX IF NOT EXISTS "ClfInboundEmailReply_inboundEmailId_idx" ON "ClfInboundEmailReply"("inboundEmailId");

DO $$ BEGIN
    ALTER TABLE "ClfInboundEmailReply" ADD CONSTRAINT "ClfInboundEmailReply_inboundEmailId_fkey"
        FOREIGN KEY ("inboundEmailId") REFERENCES "ClfInboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
