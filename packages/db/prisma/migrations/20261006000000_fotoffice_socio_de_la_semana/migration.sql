-- Socio de la semana: «Más sobre mí» y la rotación semanal (diseño 2026-10-04).
-- Va DESPUÉS de 20261005000000_fotoffice_member_welcome. Sólo crea dos tablas nuevas, sin tocar datos.
-- Se aplica a mano en la base de FOTOFFICE y después:
--   npx prisma migrate resolve --applied 20261006000000_fotoffice_socio_de_la_semana

-- CreateTable
CREATE TABLE "MemberAboutMe" (
    "memberId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "howStarted" TEXT,
    "passion" TEXT,
    "inspiration" TEXT,
    "gear" TEXT,
    "proudPhotoText" TEXT,
    "proudPhotoUrl" TEXT,
    "canHelpWith" TEXT,
    "wantsToLearn" TEXT,
    "beyondPhotography" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "spotlightNoticeAt" TIMESTAMP(3),
    "featuredPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAboutMe_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE "MemberSpotlight" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "round" INTEGER NOT NULL,
    "skippedAt" TIMESTAMP(3),
    "skippedByUserId" INTEGER,
    "skipReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSpotlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberAboutMe_workspaceId_idx" ON "MemberAboutMe"("workspaceId");

-- CreateIndex
CREATE INDEX "MemberSpotlight_workspaceId_weekStart_idx" ON "MemberSpotlight"("workspaceId", "weekStart");

-- CreateIndex
CREATE INDEX "MemberSpotlight_workspaceId_round_idx" ON "MemberSpotlight"("workspaceId", "round");

-- AddForeignKey
ALTER TABLE "MemberAboutMe" ADD CONSTRAINT "MemberAboutMe_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAboutMe" ADD CONSTRAINT "MemberAboutMe_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSpotlight" ADD CONSTRAINT "MemberSpotlight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSpotlight" ADD CONSTRAINT "MemberSpotlight_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

