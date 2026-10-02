-- Blog por institución: cada workspace de FOTOFFICE tiene su propio blog.
--
-- `workspaceKey` vale '' en todo lo existente (CompraMeLaFoto, Clickatón): para ellos nada cambia,
-- siguen teniendo un único blog por plataforma. Es texto y no FK porque '' tiene que poder
-- entrar en la clave única; un NULL no cuenta para la unicidad en Postgres.
--
-- Idempotente: se aplica a mano en cada base que tiene las tablas Blog*.

ALTER TABLE "BlogCategory" ADD COLUMN IF NOT EXISTS "workspaceKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BlogTag"      ADD COLUMN IF NOT EXISTS "workspaceKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BlogAuthor"   ADD COLUMN IF NOT EXISTS "workspaceKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BlogMedia"    ADD COLUMN IF NOT EXISTS "workspaceKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BlogPost"     ADD COLUMN IF NOT EXISTS "workspaceKey" TEXT NOT NULL DEFAULT '';

-- La clave única pasa a incluir la institución: dos instituciones pueden tener un artículo
-- con el mismo slug. Primero la nueva, después se borra la vieja: nunca hay un momento sin
-- clave única.
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_platform_workspaceKey_slug_key"     ON "BlogPost"("platform", "workspaceKey", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogCategory_platform_workspaceKey_slug_key" ON "BlogCategory"("platform", "workspaceKey", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogTag_platform_workspaceKey_slug_key"      ON "BlogTag"("platform", "workspaceKey", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogAuthor_platform_workspaceKey_slug_key"   ON "BlogAuthor"("platform", "workspaceKey", "slug");

DROP INDEX IF EXISTS "BlogPost_platform_slug_key";
DROP INDEX IF EXISTS "BlogCategory_platform_slug_key";
DROP INDEX IF EXISTS "BlogTag_platform_slug_key";
DROP INDEX IF EXISTS "BlogAuthor_platform_slug_key";

CREATE INDEX IF NOT EXISTS "BlogPost_platform_workspaceKey_status_publishedAt_idx" ON "BlogPost"("platform", "workspaceKey", "status", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogMedia_platform_workspaceKey_createdAt_idx" ON "BlogMedia"("platform", "workspaceKey", "createdAt");
