-- Clickatón: casilla de mensajes del formulario público de contacto / Formá parte.
-- Additive only.

CREATE TABLE "ClickatonContactMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "reason" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'contacto',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ClickatonContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickatonContactMessage_createdAt_idx" ON "ClickatonContactMessage"("createdAt");
CREATE INDEX "ClickatonContactMessage_isRead_createdAt_idx" ON "ClickatonContactMessage"("isRead", "createdAt");
CREATE INDEX "ClickatonContactMessage_reason_idx" ON "ClickatonContactMessage"("reason");
CREATE INDEX "ClickatonContactMessage_source_idx" ON "ClickatonContactMessage"("source");
