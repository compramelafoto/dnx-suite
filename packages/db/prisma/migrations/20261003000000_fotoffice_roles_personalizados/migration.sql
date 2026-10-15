-- Roles personalizados de FOTOFFICE (Comisión directiva), etapa 1.
-- Sólo crea tablas nuevas: no toca ninguna existente y nadie cambia de permisos al aplicarla.
-- Se aplica a mano en la base de FOTOFFICE (Neon compramelafoto, rama development) y después:
--   npx prisma migrate resolve --applied 20261003000000_fotoffice_roles_personalizados
-- Las otras bases no la necesitan: sólo FOTOFFICE consulta estas tablas.

-- CreateEnum
CREATE TYPE "ModulePermissionLevel" AS ENUM ('NONE', 'VIEW', 'MANAGE');

-- CreateTable
CREATE TABLE "WorkspaceCustomRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "templateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "level" "ModulePermissionLevel" NOT NULL,
    "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "WorkspaceRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRoleAssignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,
    "positionTitle" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "assignedById" INTEGER NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCustomRole_workspaceId_name_key" ON "WorkspaceCustomRole"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRolePermission_roleId_moduleKey_key" ON "WorkspaceRolePermission"("roleId", "moduleKey");

-- CreateIndex
CREATE INDEX "WorkspaceRoleAssignment_workspaceId_userId_idx" ON "WorkspaceRoleAssignment"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceRoleAssignment_roleId_idx" ON "WorkspaceRoleAssignment"("roleId");

-- AddForeignKey
ALTER TABLE "WorkspaceCustomRole" ADD CONSTRAINT "WorkspaceCustomRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRolePermission" ADD CONSTRAINT "WorkspaceRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceCustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRoleAssignment" ADD CONSTRAINT "WorkspaceRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRoleAssignment" ADD CONSTRAINT "WorkspaceRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceCustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

