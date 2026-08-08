-- ETAPA 13 — Biblioteca central de consignas DNX (aditiva).
-- No modifica ni borra datos comerciales existentes.

CREATE TYPE "PhotoPromptLibraryStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "PhotoPromptInspirationType" AS ENUM ('DIRECTOR', 'MOVIE', 'GENRE', 'ART_MOVEMENT', 'PHOTOGRAPHER', 'VISUAL_STYLE', 'OTHER');
CREATE TYPE "PhotoPromptDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "PhotoPromptLibraryAuditAction" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT_REVIEW', 'APPROVE', 'REJECT', 'ARCHIVE', 'RESTORE', 'ASSIGN', 'UNASSIGN', 'REORDER', 'IMPORT', 'DUPLICATE');

CREATE TABLE "PhotoPromptTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoPromptTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoPromptTheme_slug_key" ON "PhotoPromptTheme"("slug");
CREATE INDEX "PhotoPromptTheme_active_sortOrder_idx" ON "PhotoPromptTheme"("active", "sortOrder");

CREATE TABLE "PhotoPromptSubtheme" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoPromptSubtheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoPromptSubtheme_themeId_slug_key" ON "PhotoPromptSubtheme"("themeId", "slug");
CREATE INDEX "PhotoPromptSubtheme_themeId_active_sortOrder_idx" ON "PhotoPromptSubtheme"("themeId", "active", "sortOrder");

CREATE TABLE "PhotoPromptLibraryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "subthemeId" TEXT,
    "inspirationType" "PhotoPromptInspirationType",
    "inspirationLabel" TEXT,
    "inspirationNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "PhotoPromptDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "language" TEXT NOT NULL DEFAULT 'es',
    "universal" BOOLEAN NOT NULL DEFAULT true,
    "status" "PhotoPromptLibraryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "approvedByUserId" INTEGER,
    "submittedForReviewAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceKey" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoPromptLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoPromptLibraryItem_sourceKey_key" ON "PhotoPromptLibraryItem"("sourceKey");
CREATE INDEX "PhotoPromptLibraryItem_status_updatedAt_idx" ON "PhotoPromptLibraryItem"("status", "updatedAt");
CREATE INDEX "PhotoPromptLibraryItem_themeId_status_idx" ON "PhotoPromptLibraryItem"("themeId", "status");
CREATE INDEX "PhotoPromptLibraryItem_subthemeId_idx" ON "PhotoPromptLibraryItem"("subthemeId");
CREATE INDEX "PhotoPromptLibraryItem_normalizedTitle_idx" ON "PhotoPromptLibraryItem"("normalizedTitle");
CREATE INDEX "PhotoPromptLibraryItem_universal_status_idx" ON "PhotoPromptLibraryItem"("universal", "status");
CREATE INDEX "PhotoPromptLibraryItem_inspirationType_status_idx" ON "PhotoPromptLibraryItem"("inspirationType", "status");
CREATE INDEX "PhotoPromptLibraryItem_difficulty_status_idx" ON "PhotoPromptLibraryItem"("difficulty", "status");
CREATE INDEX "PhotoPromptLibraryItem_language_status_idx" ON "PhotoPromptLibraryItem"("language", "status");

CREATE TABLE "PhotoPromptLibraryVersion" (
    "id" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "themeId" TEXT,
    "subthemeId" TEXT,
    "inspirationType" "PhotoPromptInspirationType",
    "inspirationLabel" TEXT,
    "inspirationNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" "PhotoPromptDifficulty",
    "language" TEXT,
    "universal" BOOLEAN,
    "status" "PhotoPromptLibraryStatus",
    "changeSummary" TEXT,
    "snapshotJson" JSONB,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoPromptLibraryVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoPromptLibraryVersion_libraryItemId_version_key" ON "PhotoPromptLibraryVersion"("libraryItemId", "version");
CREATE INDEX "PhotoPromptLibraryVersion_libraryItemId_createdAt_idx" ON "PhotoPromptLibraryVersion"("libraryItemId", "createdAt");

CREATE TABLE "PhotoPromptLibraryAuditEvent" (
    "id" TEXT NOT NULL,
    "libraryItemId" TEXT,
    "editionId" TEXT,
    "actorUserId" INTEGER,
    "action" "PhotoPromptLibraryAuditAction" NOT NULL,
    "comment" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoPromptLibraryAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotoPromptLibraryAuditEvent_libraryItemId_createdAt_idx" ON "PhotoPromptLibraryAuditEvent"("libraryItemId", "createdAt");
CREATE INDEX "PhotoPromptLibraryAuditEvent_editionId_createdAt_idx" ON "PhotoPromptLibraryAuditEvent"("editionId", "createdAt");
CREATE INDEX "PhotoPromptLibraryAuditEvent_actorUserId_createdAt_idx" ON "PhotoPromptLibraryAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "PhotoPromptLibraryAuditEvent_action_createdAt_idx" ON "PhotoPromptLibraryAuditEvent"("action", "createdAt");

-- Snapshot fields en ClickatonPrompt (aditivo).
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "libraryItemId" TEXT;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "libraryVersion" INTEGER;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "titleSnapshot" TEXT;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "descriptionSnapshot" TEXT;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "themeSnapshot" TEXT;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "subthemeSnapshot" TEXT;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "inspirationSnapshot" JSONB;
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "assignedFromLibraryAt" TIMESTAMP(3);
ALTER TABLE "ClickatonPrompt" ADD COLUMN IF NOT EXISTS "assignedFromLibraryByUserId" INTEGER;

CREATE INDEX IF NOT EXISTS "ClickatonPrompt_libraryItemId_idx" ON "ClickatonPrompt"("libraryItemId");
CREATE INDEX IF NOT EXISTS "ClickatonPrompt_editionId_libraryItemId_idx" ON "ClickatonPrompt"("editionId", "libraryItemId");

-- FKs
ALTER TABLE "PhotoPromptSubtheme" ADD CONSTRAINT "PhotoPromptSubtheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "PhotoPromptTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoPromptLibraryItem" ADD CONSTRAINT "PhotoPromptLibraryItem_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "PhotoPromptTheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryItem" ADD CONSTRAINT "PhotoPromptLibraryItem_subthemeId_fkey" FOREIGN KEY ("subthemeId") REFERENCES "PhotoPromptSubtheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryItem" ADD CONSTRAINT "PhotoPromptLibraryItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryItem" ADD CONSTRAINT "PhotoPromptLibraryItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryItem" ADD CONSTRAINT "PhotoPromptLibraryItem_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PhotoPromptLibraryVersion" ADD CONSTRAINT "PhotoPromptLibraryVersion_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "PhotoPromptLibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryVersion" ADD CONSTRAINT "PhotoPromptLibraryVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PhotoPromptLibraryAuditEvent" ADD CONSTRAINT "PhotoPromptLibraryAuditEvent_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "PhotoPromptLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotoPromptLibraryAuditEvent" ADD CONSTRAINT "PhotoPromptLibraryAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "PhotoPromptLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClickatonPrompt" ADD CONSTRAINT "ClickatonPrompt_assignedFromLibraryByUserId_fkey" FOREIGN KEY ("assignedFromLibraryByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
