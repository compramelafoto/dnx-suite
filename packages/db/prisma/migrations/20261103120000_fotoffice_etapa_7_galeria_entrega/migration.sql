-- Etapa 7 FOTOFFICE, Entrega B: galería de entrega con fotos y videos, descarga por correo (ZIP en partes) y
-- dispositivos de DNX FLUX.
-- Suma dos columnas a `FotofficeGaleriaFoto` (tabla de la Entrega A1) y crea dos tablas nuevas:
-- `FotofficeGaleriaDescarga` y `FotofficeDispositivo`.
-- No borra nada ni actualiza filas: `mediaType` nace en 'FOTO' para las filas existentes y `contentType` en NULL.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-B.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/galerias`): la forma de `parts` y `cursor`, el tope de
-- 200 videos por galería y que un VIDEO no tenga vista ni miniatura.

-- AlterTable
ALTER TABLE "FotofficeGaleriaFoto" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'FOTO',
ADD COLUMN "contentType" TEXT;

-- CreateTable
CREATE TABLE "FotofficeGaleriaDescarga" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "galeriaClienteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "totalFiles" INTEGER NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "parts" JSONB NOT NULL DEFAULT '[]',
    "cursor" JSONB,
    "errorReason" TEXT,
    "requestedEmail" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleriaDescarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeDispositivo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeDispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDescarga_status_updatedAt_idx" ON "FotofficeGaleriaDescarga"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDescarga_galeriaClienteId_createdAt_idx" ON "FotofficeGaleriaDescarga"("galeriaClienteId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDescarga_workspaceId_idx" ON "FotofficeGaleriaDescarga"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaDescarga_galeriaId_idx" ON "FotofficeGaleriaDescarga"("galeriaId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeDispositivo_keyHash_key" ON "FotofficeDispositivo"("keyHash");

-- CreateIndex
CREATE INDEX "FotofficeDispositivo_workspaceId_revokedAt_idx" ON "FotofficeDispositivo"("workspaceId", "revokedAt");

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDescarga" ADD CONSTRAINT "FotofficeGaleriaDescarga_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDescarga" ADD CONSTRAINT "FotofficeGaleriaDescarga_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaDescarga" ADD CONSTRAINT "FotofficeGaleriaDescarga_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeDispositivo" ADD CONSTRAINT "FotofficeDispositivo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_mediaType" CHECK ("mediaType" IN ('FOTO', 'VIDEO'));
ALTER TABLE "FotofficeGaleriaDescarga" ADD CONSTRAINT "FotofficeGaleriaDescarga_status" CHECK ("status" IN ('PENDIENTE', 'ARMANDO', 'LISTA', 'ERROR', 'VENCIDA'));
ALTER TABLE "FotofficeGaleriaDescarga" ADD CONSTRAINT "FotofficeGaleriaDescarga_totales" CHECK ("totalFiles" >= 0 AND "totalBytes" >= 0);
ALTER TABLE "FotofficeDispositivo" ADD CONSTRAINT "FotofficeDispositivo_name" CHECK (char_length(btrim("name")) >= 1 AND char_length("name") <= 60);
ALTER TABLE "FotofficeDispositivo" ADD CONSTRAINT "FotofficeDispositivo_keyHash" CHECK ("keyHash" ~ '^[0-9a-f]{64}$');
