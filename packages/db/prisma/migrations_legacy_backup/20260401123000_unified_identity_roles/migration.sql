-- DNX Suite: identidad unificada, roles globales y permisos por workspace/app.

-- 1) Enums nuevos
CREATE TYPE "GlobalRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_SUPPORT', 'USER');
CREATE TYPE "WorkspaceRole" AS ENUM ('WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'STAFF');
CREATE TYPE "SuiteApp" AS ENUM ('FOTOFFICE', 'COMPRAMELAFOTO', 'FOTORANK');
CREATE TYPE "SuiteAppRole" AS ENUM (
  'PHOTOGRAPHER',
  'LAB',
  'CUSTOMER',
  'ORGANIZER_ADMIN',
  'JURY',
  'PARTICIPANT',
  'CRM_ADMIN',
  'COURSE_MANAGER',
  'SALES_ADMIN'
);

-- 2) User.globalRole (aditivo, sin romper Role legacy)
ALTER TABLE "User"
ADD COLUMN "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER';

-- Backfill inicial desde Role legacy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name = 'role'
  ) THEN
    UPDATE "User"
    SET "globalRole" = CASE
      WHEN "role" = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"GlobalRole"
      WHEN "role" = 'ADMIN' THEN 'PLATFORM_SUPPORT'::"GlobalRole"
      ELSE 'USER'::"GlobalRole"
    END;
  ELSE
    UPDATE "User"
    SET "globalRole" = 'USER'::"GlobalRole";
  END IF;
END
$$;

-- 3) WorkspaceMembership (canónico nuevo)
CREATE TABLE "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMembership_userId_workspaceId_key"
  ON "WorkspaceMembership"("userId", "workspaceId");
CREATE INDEX "WorkspaceMembership_workspaceId_role_idx"
  ON "WorkspaceMembership"("workspaceId", "role");
CREATE INDEX "WorkspaceMembership_userId_idx"
  ON "WorkspaceMembership"("userId");

ALTER TABLE "WorkspaceMembership"
ADD CONSTRAINT "WorkspaceMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMembership"
ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill desde Membership (ADMIN -> WORKSPACE_OWNER, MEMBER -> STAFF).
INSERT INTO "WorkspaceMembership" ("id", "userId", "workspaceId", "role", "createdAt", "updatedAt")
SELECT
  'wm_' || md5(random()::text || clock_timestamp()::text || "userId"::text || "workspaceId"),
  "userId",
  "workspaceId",
  CASE
    WHEN "role" = 'ADMIN' THEN 'WORKSPACE_OWNER'::"WorkspaceRole"
    ELSE 'STAFF'::"WorkspaceRole"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Membership"
ON CONFLICT ("userId", "workspaceId") DO NOTHING;

-- 4) WorkspaceAppAccess
CREATE TABLE "WorkspaceAppAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "app" "SuiteApp" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "appRole" "SuiteAppRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceAppAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceAppAccess_userId_workspaceId_app_key"
  ON "WorkspaceAppAccess"("userId", "workspaceId", "app");
CREATE INDEX "WorkspaceAppAccess_workspaceId_app_enabled_idx"
  ON "WorkspaceAppAccess"("workspaceId", "app", "enabled");
CREATE INDEX "WorkspaceAppAccess_userId_app_idx"
  ON "WorkspaceAppAccess"("userId", "app");

ALTER TABLE "WorkspaceAppAccess"
ADD CONSTRAINT "WorkspaceAppAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceAppAccess"
ADD CONSTRAINT "WorkspaceAppAccess_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
