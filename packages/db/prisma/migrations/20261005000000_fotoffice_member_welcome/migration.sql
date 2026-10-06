-- Comunicación → Placas: la lista de bienvenidas a socios nuevos (diseño 2026-10-04).
-- Sólo crea una tabla nueva, sin tocar datos. Se aplica a mano en la base de FOTOFFICE y después:
--   npx prisma migrate resolve --applied 20261005000000_fotoffice_member_welcome

-- CreateTable
CREATE TABLE "MemberWelcome" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberWelcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberWelcome_memberId_key" ON "MemberWelcome"("memberId");

-- CreateIndex
CREATE INDEX "MemberWelcome_workspaceId_createdAt_idx" ON "MemberWelcome"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberWelcome" ADD CONSTRAINT "MemberWelcome_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberWelcome" ADD CONSTRAINT "MemberWelcome_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

