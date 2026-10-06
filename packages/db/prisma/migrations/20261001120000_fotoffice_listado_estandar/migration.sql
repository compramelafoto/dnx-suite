-- Etapa 0.2 FOTOFFICE: listado estándar. Puramente ADITIVO: dos tablas propias de FOTOFFICE.
-- No toca Workspace, WorkspaceMembership ni WorkspaceFeatureModule.

CREATE TABLE "FotofficeListView" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "query" TEXT NOT NULL DEFAULT '',
    "ownerUserId" INTEGER NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeListView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeListView_workspaceId_listKey_kind_idx" ON "FotofficeListView"("workspaceId", "listKey", "kind");
CREATE INDEX "FotofficeListView_ownerUserId_idx" ON "FotofficeListView"("ownerUserId");
-- Una sola ULTIMA por persona, workspace y lista.
CREATE UNIQUE INDEX "FotofficeListView_ultima_unica" ON "FotofficeListView"("workspaceId", "listKey", "ownerUserId") WHERE "kind" = 'ULTIMA';
ALTER TABLE "FotofficeListView" ADD CONSTRAINT "FotofficeListView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeListView" ADD CONSTRAINT "FotofficeListView_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FotofficeListActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "action" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeListActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeListActivity_workspaceId_listKey_createdAt_idx" ON "FotofficeListActivity"("workspaceId", "listKey", "createdAt");
ALTER TABLE "FotofficeListActivity" ADD CONSTRAINT "FotofficeListActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeListActivity" ADD CONSTRAINT "FotofficeListActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
