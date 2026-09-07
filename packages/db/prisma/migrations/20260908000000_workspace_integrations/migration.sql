-- Integraciones con terceros por workspace. Puramente aditiva: dos tablas nuevas,
-- ninguna columna existente modificada.

CREATE TABLE "WorkspaceIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "accountExternalId" TEXT,
    "grantedScopes" TEXT[],
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "connectedByUserId" INTEGER,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegration_workspaceId_integrationKey_key"
    ON "WorkspaceIntegration"("workspaceId", "integrationKey");
CREATE INDEX "WorkspaceIntegration_workspaceId_status_idx"
    ON "WorkspaceIntegration"("workspaceId", "status");

ALTER TABLE "WorkspaceIntegration" ADD CONSTRAINT "WorkspaceIntegration_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspaceIntegrationOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "redirectPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceIntegrationOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegrationOAuthState_state_key"
    ON "WorkspaceIntegrationOAuthState"("state");
CREATE INDEX "WorkspaceIntegrationOAuthState_expiresAt_idx"
    ON "WorkspaceIntegrationOAuthState"("expiresAt");
CREATE INDEX "WorkspaceIntegrationOAuthState_workspaceId_idx"
    ON "WorkspaceIntegrationOAuthState"("workspaceId");
