-- FOTOFFICE: digitalización, partes 3 y 4 (entrega, cargos extra, envío de cassettes, HLS y
-- comisión). Tablas nuevas y columnas nuevas en tablas propias de digitalización. Idempotente.
ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "hlsKey" TEXT;
ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "descargasExtra" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "videoBorradoAt" TIMESTAMP(3);
ALTER TABLE "DigitalizacionAjustes" ADD COLUMN IF NOT EXISTS "envioAutomatico" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DigitalizacionAjustes" ADD COLUMN IF NOT EXISTS "enviosFranjas" JSONB;

CREATE TABLE IF NOT EXISTS "DigitalizacionEntrega" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "envioAutomatico" BOOLEAN NOT NULL DEFAULT true,
    "accessTokenHash" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "videosVencenAt" TIMESTAMP(3),
    "cassettesVencenAt" TIMESTAMP(3),
    "recordatorios" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "extensiones" INTEGER NOT NULL DEFAULT 0,
    "videosBorradosAt" TIMESTAMP(3),
    "envioEstado" TEXT,
    "envioDireccion" TEXT,
    "envioLat" DOUBLE PRECISION,
    "envioLng" DOUBLE PRECISION,
    "envioKm" DOUBLE PRECISION,
    "envioPrecioArs" DECIMAL(12,2),
    "envioPedidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DigitalizacionEntrega_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionEntrega_pedidoId_key" ON "DigitalizacionEntrega"("pedidoId");
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionEntrega_accessTokenHash_key" ON "DigitalizacionEntrega"("accessTokenHash");
CREATE INDEX IF NOT EXISTS "DigitalizacionEntrega_workspaceId_enviadoAt_idx" ON "DigitalizacionEntrega"("workspaceId", "enviadoAt");
CREATE INDEX IF NOT EXISTS "DigitalizacionEntrega_videosVencenAt_idx" ON "DigitalizacionEntrega"("videosVencenAt");

CREATE TABLE IF NOT EXISTS "DigitalizacionDescarga" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "grabacionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigitalizacionDescarga_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DigitalizacionDescarga_grabacionId_idx" ON "DigitalizacionDescarga"("grabacionId");
CREATE INDEX IF NOT EXISTS "DigitalizacionDescarga_entregaId_idx" ON "DigitalizacionDescarga"("entregaId");
CREATE INDEX IF NOT EXISTS "DigitalizacionDescarga_workspaceId_idx" ON "DigitalizacionDescarga"("workspaceId");

CREATE TABLE IF NOT EXISTS "DigitalizacionCargo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "grabacionId" TEXT,
    "montoArs" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "aplicadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigitalizacionCargo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionCargo_cuotaId_key" ON "DigitalizacionCargo"("cuotaId");
CREATE INDEX IF NOT EXISTS "DigitalizacionCargo_entregaId_estado_idx" ON "DigitalizacionCargo"("entregaId", "estado");
CREATE INDEX IF NOT EXISTS "DigitalizacionCargo_pedidoId_idx" ON "DigitalizacionCargo"("pedidoId");
CREATE INDEX IF NOT EXISTS "DigitalizacionCargo_grabacionId_idx" ON "DigitalizacionCargo"("grabacionId");
CREATE INDEX IF NOT EXISTS "DigitalizacionCargo_workspaceId_idx" ON "DigitalizacionCargo"("workspaceId");

CREATE TABLE IF NOT EXISTS "DigitalizacionComision" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cobroId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigitalizacionComision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionComision_cobroId_key" ON "DigitalizacionComision"("cobroId");
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionComision_ledgerEntryId_key" ON "DigitalizacionComision"("ledgerEntryId");
CREATE INDEX IF NOT EXISTS "DigitalizacionComision_workspaceId_idx" ON "DigitalizacionComision"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "DigitalizacionEntrega" ADD CONSTRAINT "DigitalizacionEntrega_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionEntrega" ADD CONSTRAINT "DigitalizacionEntrega_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionDescarga" ADD CONSTRAINT "DigitalizacionDescarga_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionDescarga" ADD CONSTRAINT "DigitalizacionDescarga_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "DigitalizacionEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionDescarga" ADD CONSTRAINT "DigitalizacionDescarga_grabacionId_fkey" FOREIGN KEY ("grabacionId") REFERENCES "DigitalizacionGrabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionCargo" ADD CONSTRAINT "DigitalizacionCargo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionCargo" ADD CONSTRAINT "DigitalizacionCargo_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "DigitalizacionEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionCargo" ADD CONSTRAINT "DigitalizacionCargo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionCargo" ADD CONSTRAINT "DigitalizacionCargo_grabacionId_fkey" FOREIGN KEY ("grabacionId") REFERENCES "DigitalizacionGrabacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionComision" ADD CONSTRAINT "DigitalizacionComision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
