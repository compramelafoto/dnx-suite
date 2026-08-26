-- AlterTable
ALTER TABLE "FotofficeWorkspaceWebsite" ADD COLUMN     "publishedVersionId" TEXT;

-- CreateTable
CREATE TABLE "FotofficeWorkspaceWebsiteVersion" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "navJson" JSONB,
    "sectionsJson" JSONB,
    "publishedByUserId" INTEGER,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeWorkspaceWebsiteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWorkspaceWebsiteVersion_websiteId_versionNumber_key" ON "FotofficeWorkspaceWebsiteVersion"("websiteId", "versionNumber");

-- CreateIndex
CREATE INDEX "FotofficeWorkspaceWebsiteVersion_websiteId_publishedAt_idx" ON "FotofficeWorkspaceWebsiteVersion"("websiteId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWorkspaceWebsite_publishedVersionId_key" ON "FotofficeWorkspaceWebsite"("publishedVersionId");

-- AddForeignKey
ALTER TABLE "FotofficeWorkspaceWebsite" ADD CONSTRAINT "FotofficeWorkspaceWebsite_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "FotofficeWorkspaceWebsiteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWorkspaceWebsiteVersion" ADD CONSTRAINT "FotofficeWorkspaceWebsiteVersion_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "FotofficeWorkspaceWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWorkspaceWebsiteVersion" ADD CONSTRAINT "FotofficeWorkspaceWebsiteVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: workspaces que ya tenían el sitio "publicado" (publishedAt seteado) antes de que
-- existiera el versionado quedan con una Version 1 equivalente a su estado actual (aunque hoy
-- ese estado sea contenido vacío), y publishedVersionId apuntando a ella. No se inventa
-- contenido: se copia exactamente lo que ya estaba en cada columna.
INSERT INTO "FotofficeWorkspaceWebsiteVersion"
  ("id", "websiteId", "versionNumber", "heroTitle", "heroSubtitle", "seoTitle", "seoDescription", "navJson", "sectionsJson", "publishedByUserId", "publishedAt", "createdAt")
SELECT
  gen_random_uuid()::text, "id", 1, "heroTitle", "heroSubtitle", "seoTitle", "seoDescription", "navJson", "sectionsJson", NULL, "publishedAt", "publishedAt"
FROM "FotofficeWorkspaceWebsite"
WHERE "publishedAt" IS NOT NULL;

UPDATE "FotofficeWorkspaceWebsite" AS w
SET "publishedVersionId" = v."id"
FROM "FotofficeWorkspaceWebsiteVersion" AS v
WHERE v."websiteId" = w."id" AND v."versionNumber" = 1 AND w."publishedAt" IS NOT NULL;
