-- Historial inmutable de operaciones sobre socios (módulo institucional `members`).
-- Puramente ADITIVO: crea dos tipos y una tabla nueva. No altera ni borra nada existente,
-- así que el código anterior sigue funcionando con esta migración ya aplicada.

-- CreateEnum
CREATE TYPE "MemberAuditAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'IMPORTED', 'USER_LINKED', 'USER_UNLINKED');

-- CreateEnum
CREATE TYPE "MemberAuditSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'SYSTEM');

-- CreateTable
CREATE TABLE "MemberAudit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "action" "MemberAuditAction" NOT NULL,
    "source" "MemberAuditSource" NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "changesJson" JSONB,
    "reason" TEXT,
    "batchId" TEXT,
    "sourceRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberAudit_workspaceId_memberId_createdAt_idx" ON "MemberAudit"("workspaceId", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberAudit_workspaceId_createdAt_idx" ON "MemberAudit"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberAudit_batchId_idx" ON "MemberAudit"("batchId");

-- AddForeignKey
-- Cascade: política general de tenants. En la práctica no se dispara: deleteWorkspaceAction
-- ya bloquea el borrado de un workspace que tenga socios.
ALTER TABLE "MemberAudit" ADD CONSTRAINT "MemberAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- RESTRICT a propósito: borrar un socio nunca puede llevarse su historial en silencio.
ALTER TABLE "MemberAudit" ADD CONSTRAINT "MemberAudit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL: borrar el usuario del administrador no borra lo que hizo; queda `actorLabel`.
ALTER TABLE "MemberAudit" ADD CONSTRAINT "MemberAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
