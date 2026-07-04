-- CreateTable: OrderAuditLog (auditoría antifraude)
CREATE TABLE IF NOT EXISTS "OrderAuditLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" INTEGER,
    "actorRole" TEXT,
    "targetOrderType" TEXT NOT NULL,
    "targetOrderId" INTEGER NOT NULL,
    "targetAlbumId" INTEGER,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "riskScoreSnapshot" INTEGER,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderAuditLog_targetOrderType_targetOrderId_idx" ON "OrderAuditLog"("targetOrderType", "targetOrderId");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_actorUserId_idx" ON "OrderAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_eventType_idx" ON "OrderAuditLog"("eventType");
CREATE INDEX IF NOT EXISTS "OrderAuditLog_createdAt_idx" ON "OrderAuditLog"("createdAt");

-- CreateTable: WebhookEvent (idempotencia webhook MP)
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,
    "orderId" INTEGER,
    "orderType" TEXT,
    "status" TEXT,
    "externalRef" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT,
    "rawPayload" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_paymentId_key" ON "WebhookEvent"("paymentId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_paymentId_idx" ON "WebhookEvent"("paymentId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_orderId_orderType_idx" ON "WebhookEvent"("orderId", "orderType");

-- CreateTable: FraudAlert
CREATE TABLE IF NOT EXISTS "FraudAlert" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" INTEGER,
    "userId" INTEGER,
    "labId" INTEGER,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "riskScore" INTEGER,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FraudAlert_userId_idx" ON "FraudAlert"("userId");
CREATE INDEX IF NOT EXISTS "FraudAlert_labId_idx" ON "FraudAlert"("labId");
CREATE INDEX IF NOT EXISTS "FraudAlert_ruleCode_idx" ON "FraudAlert"("ruleCode");
CREATE INDEX IF NOT EXISTS "FraudAlert_status_idx" ON "FraudAlert"("status");
CREATE INDEX IF NOT EXISTS "FraudAlert_createdAt_idx" ON "FraudAlert"("createdAt");

-- CreateTable: AccountRestriction
CREATE TABLE IF NOT EXISTS "AccountRestriction" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "userId" INTEGER,
    "labId" INTEGER,
    "restrictionType" TEXT NOT NULL,
    "reason" TEXT,
    "appliedBy" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "AccountRestriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountRestriction_userId_idx" ON "AccountRestriction"("userId");
CREATE INDEX IF NOT EXISTS "AccountRestriction_labId_idx" ON "AccountRestriction"("labId");
CREATE INDEX IF NOT EXISTS "AccountRestriction_restrictionType_idx" ON "AccountRestriction"("restrictionType");
CREATE INDEX IF NOT EXISTS "AccountRestriction_expiresAt_idx" ON "AccountRestriction"("expiresAt");
