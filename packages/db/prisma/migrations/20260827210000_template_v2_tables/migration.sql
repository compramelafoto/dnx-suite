-- Módulo de diseño — tablas del editor Template V2.
--
-- Contexto: los modelos están en el esquema desde hace tiempo, pero las tablas nunca se
-- crearon en esta base. Una migración de julio lo dice explícitamente: "Intentionally skips
-- TemplateV2* tables (absent on staging)". Por eso Clickatón envuelve sus consultas en un
-- manejador de "migración pendiente" y su editor nunca funcionó contra producción.
--
-- Se crean ahora para habilitar el diseñador del carnet de socio de FotOffice, y de paso el
-- editor de Clickatón y ComprameLaFoto, que comparten el mismo módulo.
--
-- COMPATIBILIDAD CON PRODUCCIÓN — migración ADITIVA:
--   * Solo crea 5 enums y 6 tablas nuevas, con sus índices. No modifica ninguna existente.
--   * Sin filas, nada cambia: las tres apps siguen comportándose igual hasta que alguien
--     cree su primera plantilla.
--   * NO se agrega la clave foránea pendiente AlbumPack.templateV2Id → TemplateV2.id. Toca
--     una tabla con datos de ComprameLaFoto y no hace falta para que el editor funcione;
--     queda como decisión de esa app.

-- CreateEnum
CREATE TYPE "TemplateV2Status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TemplateV2BlockType" AS ENUM ('BACKGROUND', 'PHOTO', 'TEXT', 'VARIABLE_TEXT', 'IMAGE', 'SHAPE');

-- CreateEnum
CREATE TYPE "TemplateV2AssetKind" AS ENUM ('IMAGE', 'LOGO', 'FONT');

-- CreateEnum
CREATE TYPE "TemplateV2Visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TemplateV2ReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TemplateV2" (
    "id" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TemplateV2Status" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateV2Version" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "canvasJson" JSONB NOT NULL,
    "metaJson" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateV2Block" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "type" "TemplateV2BlockType" NOT NULL,
    "name" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "configJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateV2Asset" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "kind" "TemplateV2AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateV2VariableBinding" (
    "id" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "variableKey" TEXT NOT NULL,
    "formatter" TEXT,
    "fallbackOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2VariableBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateV2Publication" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "visibility" "TemplateV2Visibility" NOT NULL DEFAULT 'PRIVATE',
    "reviewStatus" "TemplateV2ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNotes" TEXT,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "publishedByUserId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateV2Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateV2_currentVersionId_key" ON "TemplateV2"("currentVersionId");

-- CreateIndex
CREATE INDEX "TemplateV2_ownerUserId_idx" ON "TemplateV2"("ownerUserId");

-- CreateIndex
CREATE INDEX "TemplateV2_workspaceId_idx" ON "TemplateV2"("workspaceId");

-- CreateIndex
CREATE INDEX "TemplateV2_status_idx" ON "TemplateV2"("status");

-- CreateIndex
CREATE INDEX "TemplateV2Version_templateId_idx" ON "TemplateV2Version"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateV2Version_templateId_versionNumber_key" ON "TemplateV2Version"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "TemplateV2Block_templateVersionId_idx" ON "TemplateV2Block"("templateVersionId");

-- CreateIndex
CREATE INDEX "TemplateV2Block_templateVersionId_pageIndex_idx" ON "TemplateV2Block"("templateVersionId", "pageIndex");

-- CreateIndex
CREATE INDEX "TemplateV2Block_type_idx" ON "TemplateV2Block"("type");

-- CreateIndex
CREATE INDEX "TemplateV2Asset_templateVersionId_idx" ON "TemplateV2Asset"("templateVersionId");

-- CreateIndex
CREATE INDEX "TemplateV2VariableBinding_templateVersionId_idx" ON "TemplateV2VariableBinding"("templateVersionId");

-- CreateIndex
CREATE INDEX "TemplateV2VariableBinding_blockId_idx" ON "TemplateV2VariableBinding"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateV2Publication_templateId_key" ON "TemplateV2Publication"("templateId");

-- CreateIndex
CREATE INDEX "TemplateV2Publication_reviewStatus_idx" ON "TemplateV2Publication"("reviewStatus");

-- CreateIndex
CREATE INDEX "TemplateV2Publication_visibility_idx" ON "TemplateV2Publication"("visibility");
