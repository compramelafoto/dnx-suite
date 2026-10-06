-- Etapa 0.1 FOTOFFICE: equipo, invitaciones, bitácora y tipo de organización.
-- Puramente ADITIVO. No agrega columnas a Workspace, WorkspaceMembership ni
-- WorkspaceFeatureModule, que leen todas las apps con el mismo cliente Prisma.

-- 1) Rol nuevo. ADD VALUE no puede correr dentro de la misma transacción que lo use.
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'COLLABORATOR';

-- 2) Tipo de organización (tabla propia de FOTOFFICE).
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN "organizationType" TEXT;

-- 3) Invitaciones de equipo.
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendFailedAt" TIMESTAMP(3),
    "invitedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_email_idx" ON "WorkspaceInvitation"("workspaceId", "email");
CREATE INDEX "WorkspaceInvitation_expiresAt_idx" ON "WorkspaceInvitation"("expiresAt");
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Bitácora administrativa.
CREATE TABLE "WorkspaceAdminEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "targetUserId" INTEGER,
    "targetEmail" TEXT,
    "kind" TEXT NOT NULL,
    "fromRole" TEXT,
    "toRole" TEXT,
    "moduleKey" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceAdminEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceAdminEvent_workspaceId_createdAt_idx" ON "WorkspaceAdminEvent"("workspaceId", "createdAt");
ALTER TABLE "WorkspaceAdminEvent" ADD CONSTRAINT "WorkspaceAdminEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
