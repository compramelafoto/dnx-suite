-- Sincronización con Google Contacts. Puramente aditivo, y se puede correr dos veces.
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

-- La marca de "dame solo lo que cambió" de la People API. Es por cuenta conectada.
ALTER TABLE "WorkspaceIntegration" ADD COLUMN IF NOT EXISTS "syncCursor" TEXT;

-- El interruptor de cada módulo.
CREATE TABLE IF NOT EXISTS "WorkspaceContactSyncSetting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "googleGroupResourceName" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncOk" BOOLEAN,
    "lastSyncMessage" TEXT,
    "syncedContacts" INTEGER NOT NULL DEFAULT 0,
    "enabledByUserId" INTEGER,
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceContactSyncSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceContactSyncSetting_workspaceId_moduleKey_key"
    ON "WorkspaceContactSyncSetting"("workspaceId", "moduleKey");
CREATE INDEX IF NOT EXISTS "WorkspaceContactSyncSetting_enabled_idx"
    ON "WorkspaceContactSyncSetting"("enabled");

DO $$ BEGIN
    ALTER TABLE "WorkspaceContactSyncSetting"
        ADD CONSTRAINT "WorkspaceContactSyncSetting_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- El puente persona ↔ contacto de Google.
CREATE TABLE IF NOT EXISTS "WorkspaceContactLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "resourceName" TEXT NOT NULL,
    "etag" TEXT,
    "localFingerprint" TEXT NOT NULL,
    "remoteFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LINKED',
    "lastPushedAt" TIMESTAMP(3),
    "lastPulledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceContactLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceContactLink_workspaceId_sourceType_sourceId_key"
    ON "WorkspaceContactLink"("workspaceId", "sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceContactLink_workspaceId_resourceName_key"
    ON "WorkspaceContactLink"("workspaceId", "resourceName");
CREATE INDEX IF NOT EXISTS "WorkspaceContactLink_workspaceId_moduleKey_status_idx"
    ON "WorkspaceContactLink"("workspaceId", "moduleKey", "status");

DO $$ BEGIN
    ALTER TABLE "WorkspaceContactLink"
        ADD CONSTRAINT "WorkspaceContactLink_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
