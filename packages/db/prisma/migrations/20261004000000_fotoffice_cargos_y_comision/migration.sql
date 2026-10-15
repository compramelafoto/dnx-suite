-- Roles de FOTOFFICE, etapa 2: cargos y mandatos, asignación por ficha de socio, roles archivables.
-- Va DESPUÉS de 20261003000000_fotoffice_roles_personalizados. Sólo toca tablas de esa migración
-- (todavía sin datos) y crea dos nuevas. Se aplica a mano en la base de FOTOFFICE y después:
--   npx prisma migrate resolve --applied 20261004000000_fotoffice_cargos_y_comision

-- AlterTable
ALTER TABLE "WorkspaceCustomRole" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkspaceRoleAssignment" DROP COLUMN "positionTitle",
ADD COLUMN     "memberId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WorkspaceOffice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "votes" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "templateKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceOfficeTerm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "memberId" TEXT,
    "userId" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "assignedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceOfficeTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceOffice_workspaceId_name_key" ON "WorkspaceOffice"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkspaceOfficeTerm_workspaceId_officeId_idx" ON "WorkspaceOfficeTerm"("workspaceId", "officeId");

-- CreateIndex
CREATE INDEX "WorkspaceOfficeTerm_workspaceId_memberId_idx" ON "WorkspaceOfficeTerm"("workspaceId", "memberId");

-- CreateIndex
CREATE INDEX "WorkspaceOfficeTerm_workspaceId_userId_idx" ON "WorkspaceOfficeTerm"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceRoleAssignment_workspaceId_memberId_idx" ON "WorkspaceRoleAssignment"("workspaceId", "memberId");

-- AddForeignKey
ALTER TABLE "WorkspaceRoleAssignment" ADD CONSTRAINT "WorkspaceRoleAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOffice" ADD CONSTRAINT "WorkspaceOffice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOfficeTerm" ADD CONSTRAINT "WorkspaceOfficeTerm_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "WorkspaceOffice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOfficeTerm" ADD CONSTRAINT "WorkspaceOfficeTerm_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceOfficeTerm" ADD CONSTRAINT "WorkspaceOfficeTerm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Al menos una persona: usuario o ficha de socio. Prisma no modela CHECK; vive sólo acá.
ALTER TABLE "WorkspaceRoleAssignment"
  ADD CONSTRAINT "WorkspaceRoleAssignment_person_check" CHECK ("userId" IS NOT NULL OR "memberId" IS NOT NULL);
ALTER TABLE "WorkspaceOfficeTerm"
  ADD CONSTRAINT "WorkspaceOfficeTerm_person_check" CHECK ("userId" IS NOT NULL OR "memberId" IS NOT NULL);
