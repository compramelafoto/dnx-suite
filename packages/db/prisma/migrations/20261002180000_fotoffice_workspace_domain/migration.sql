-- Dominio propio del sitio público de una institución (Sitio web → Dominio).
CREATE TABLE "FotofficeWorkspaceDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "vercelRegisteredAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWorkspaceDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FotofficeWorkspaceDomain_workspaceId_key" ON "FotofficeWorkspaceDomain"("workspaceId");
CREATE UNIQUE INDEX "FotofficeWorkspaceDomain_domain_key" ON "FotofficeWorkspaceDomain"("domain");

ALTER TABLE "FotofficeWorkspaceDomain" ADD CONSTRAINT "FotofficeWorkspaceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
