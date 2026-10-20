-- FOTOFFICE: impresión (etapa 1). Tamaños, salidas, producción de productos, preparaciones del mostrador y registro de hojas. Idempotente.

ALTER TABLE "FotofficeAttachment" ADD COLUMN IF NOT EXISTS "origen" TEXT;

CREATE TABLE IF NOT EXISTS "FotofficeTamanoImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anchoMm" DECIMAL(6,1) NOT NULL,
    "altoMm" DECIMAL(6,1) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTamanoImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeSalidaImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "proveedorId" TEXT,
    "ppp" INTEGER NOT NULL DEFAULT 300,
    "nitidez" TEXT NOT NULL DEFAULT 'NORMAL',
    "escalaXMil" INTEGER NOT NULL DEFAULT 1000,
    "escalaYMil" INTEGER NOT NULL DEFAULT 1000,
    "margenSinBordesMm" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "admiteCopias" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeSalidaImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeSalidaTamano" (
    "salidaId" TEXT NOT NULL,
    "tamanoId" TEXT NOT NULL,

    CONSTRAINT "FotofficeSalidaTamano_pkey" PRIMARY KEY ("salidaId","tamanoId")
);

CREATE TABLE IF NOT EXISTS "FotofficeProductoProduccion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tipoPieza" TEXT NOT NULL,
    "salidaId" TEXT NOT NULL,
    "tamanoHojaId" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'HOJA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeProductoProduccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficePreparacionImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "clientId" TEXT,
    "saleItemId" TEXT,
    "proyectoId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PREPARANDO',
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePreparacionImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeOriginalImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "preparacionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "previewKey" TEXT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "anchoPx" INTEGER NOT NULL DEFAULT 0,
    "altoPx" INTEGER NOT NULL DEFAULT 0,
    "perfilColor" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "archivoTrabajoId" TEXT,
    "adjuntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeOriginalImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficePiezaImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "preparacionId" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanoId" TEXT,
    "anchoMm" DECIMAL(6,1),
    "altoMm" DECIMAL(6,1),
    "receta" JSONB NOT NULL,
    "huella" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "revisadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePiezaImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeHojaImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "preparacionId" TEXT NOT NULL,
    "salidaId" TEXT NOT NULL,
    "tamanoId" TEXT NOT NULL,
    "disposicion" JSONB NOT NULL,
    "finalKey" TEXT,
    "finalHuella" TEXT,
    "finalAnchoPx" INTEGER NOT NULL DEFAULT 0,
    "finalAltoPx" INTEGER NOT NULL DEFAULT 0,
    "copias" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeHojaImpresion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FotofficeRegistroImpresion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hojaId" TEXT,
    "salidaId" TEXT NOT NULL,
    "tamanoId" TEXT NOT NULL,
    "hojas" INTEGER NOT NULL,
    "productId" TEXT,
    "saleItemId" TEXT,
    "proyectoId" TEXT,
    "motivo" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeRegistroImpresion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FotofficeTamanoImpresion_workspaceId_activo_orden_idx" ON "FotofficeTamanoImpresion"("workspaceId", "activo", "orden");

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTamanoImpresion_workspaceId_nombre_key" ON "FotofficeTamanoImpresion"("workspaceId", "nombre");

CREATE INDEX IF NOT EXISTS "FotofficeSalidaImpresion_workspaceId_activo_idx" ON "FotofficeSalidaImpresion"("workspaceId", "activo");

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeSalidaImpresion_workspaceId_nombre_key" ON "FotofficeSalidaImpresion"("workspaceId", "nombre");

CREATE INDEX IF NOT EXISTS "FotofficeSalidaTamano_tamanoId_idx" ON "FotofficeSalidaTamano"("tamanoId");

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeProductoProduccion_productId_key" ON "FotofficeProductoProduccion"("productId");

CREATE INDEX IF NOT EXISTS "FotofficeProductoProduccion_workspaceId_idx" ON "FotofficeProductoProduccion"("workspaceId");

CREATE INDEX IF NOT EXISTS "FotofficeProductoProduccion_salidaId_idx" ON "FotofficeProductoProduccion"("salidaId");

CREATE INDEX IF NOT EXISTS "FotofficeProductoProduccion_tamanoHojaId_idx" ON "FotofficeProductoProduccion"("tamanoHojaId");

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePreparacionImpresion_saleItemId_key" ON "FotofficePreparacionImpresion"("saleItemId");

CREATE INDEX IF NOT EXISTS "FotofficePreparacionImpresion_workspaceId_estado_createdAt_idx" ON "FotofficePreparacionImpresion"("workspaceId", "estado", "createdAt");

CREATE INDEX IF NOT EXISTS "FotofficePreparacionImpresion_workspaceId_saleItemId_idx" ON "FotofficePreparacionImpresion"("workspaceId", "saleItemId");

CREATE INDEX IF NOT EXISTS "FotofficePreparacionImpresion_createdAt_idx" ON "FotofficePreparacionImpresion"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeOriginalImpresion_key_key" ON "FotofficeOriginalImpresion"("key");

CREATE INDEX IF NOT EXISTS "FotofficeOriginalImpresion_preparacionId_createdAt_idx" ON "FotofficeOriginalImpresion"("preparacionId", "createdAt");

CREATE INDEX IF NOT EXISTS "FotofficeOriginalImpresion_workspaceId_estado_createdAt_idx" ON "FotofficeOriginalImpresion"("workspaceId", "estado", "createdAt");

CREATE INDEX IF NOT EXISTS "FotofficePiezaImpresion_preparacionId_idx" ON "FotofficePiezaImpresion"("preparacionId");

CREATE INDEX IF NOT EXISTS "FotofficePiezaImpresion_originalId_idx" ON "FotofficePiezaImpresion"("originalId");

CREATE INDEX IF NOT EXISTS "FotofficeHojaImpresion_preparacionId_idx" ON "FotofficeHojaImpresion"("preparacionId");

CREATE INDEX IF NOT EXISTS "FotofficeHojaImpresion_salidaId_idx" ON "FotofficeHojaImpresion"("salidaId");

CREATE INDEX IF NOT EXISTS "FotofficeHojaImpresion_tamanoId_idx" ON "FotofficeHojaImpresion"("tamanoId");

CREATE INDEX IF NOT EXISTS "FotofficeRegistroImpresion_workspaceId_createdAt_idx" ON "FotofficeRegistroImpresion"("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "FotofficeRegistroImpresion_workspaceId_salidaId_createdAt_idx" ON "FotofficeRegistroImpresion"("workspaceId", "salidaId", "createdAt");

CREATE INDEX IF NOT EXISTS "FotofficeRegistroImpresion_hojaId_idx" ON "FotofficeRegistroImpresion"("hojaId");

CREATE INDEX IF NOT EXISTS "FotofficeRegistroImpresion_saleItemId_idx" ON "FotofficeRegistroImpresion"("saleItemId");

CREATE INDEX IF NOT EXISTS "FotofficeAttachment_workspaceId_clientId_origen_idx" ON "FotofficeAttachment"("workspaceId", "clientId", "origen");

DO $$ BEGIN
  ALTER TABLE "FotofficeTamanoImpresion" ADD CONSTRAINT "FotofficeTamanoImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "FotofficeProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaTamano" ADD CONSTRAINT "FotofficeSalidaTamano_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "FotofficeSalidaImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaTamano" ADD CONSTRAINT "FotofficeSalidaTamano_tamanoId_fkey" FOREIGN KEY ("tamanoId") REFERENCES "FotofficeTamanoImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "FotofficeSalidaImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_tamanoHojaId_fkey" FOREIGN KEY ("tamanoHojaId") REFERENCES "FotofficeTamanoImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeOriginalImpresion" ADD CONSTRAINT "FotofficeOriginalImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeOriginalImpresion" ADD CONSTRAINT "FotofficeOriginalImpresion_preparacionId_fkey" FOREIGN KEY ("preparacionId") REFERENCES "FotofficePreparacionImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeOriginalImpresion" ADD CONSTRAINT "FotofficeOriginalImpresion_archivoTrabajoId_fkey" FOREIGN KEY ("archivoTrabajoId") REFERENCES "FotofficeArchivoTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeOriginalImpresion" ADD CONSTRAINT "FotofficeOriginalImpresion_adjuntoId_fkey" FOREIGN KEY ("adjuntoId") REFERENCES "FotofficeAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_preparacionId_fkey" FOREIGN KEY ("preparacionId") REFERENCES "FotofficePreparacionImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_originalId_fkey" FOREIGN KEY ("originalId") REFERENCES "FotofficeOriginalImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_preparacionId_fkey" FOREIGN KEY ("preparacionId") REFERENCES "FotofficePreparacionImpresion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "FotofficeSalidaImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_tamanoId_fkey" FOREIGN KEY ("tamanoId") REFERENCES "FotofficeTamanoImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_hojaId_fkey" FOREIGN KEY ("hojaId") REFERENCES "FotofficeHojaImpresion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_salidaId_fkey" FOREIGN KEY ("salidaId") REFERENCES "FotofficeSalidaImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_tamanoId_fkey" FOREIGN KEY ("tamanoId") REFERENCES "FotofficeTamanoImpresion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_tipo_check" CHECK ("tipo" IN ('LOCAL','LABORATORIO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_nitidez_check" CHECK ("nitidez" IN ('SUAVE','NORMAL','FUERTE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_ppp_check" CHECK ("ppp" BETWEEN 72 AND 1200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeSalidaImpresion" ADD CONSTRAINT "FotofficeSalidaImpresion_escala_check" CHECK ("escalaXMil" BETWEEN 900 AND 1100 AND "escalaYMil" BETWEEN 900 AND 1100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeTamanoImpresion" ADD CONSTRAINT "FotofficeTamanoImpresion_medida_check" CHECK ("anchoMm" > 0 AND "altoMm" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_tipo_check" CHECK ("tipoPieza" IN ('COPIA','CARNET','POLAROID'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeProductoProduccion" ADD CONSTRAINT "FotofficeProductoProduccion_unidad_check" CHECK ("unidad" IN ('HOJA','COPIA','PIEZA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_estado_check" CHECK ("estado" IN ('PREPARANDO','LISTA','IMPRESA','ANULADA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePreparacionImpresion" ADD CONSTRAINT "FotofficePreparacionImpresion_destino_check" CHECK ("saleItemId" IS NULL OR "proyectoId" IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_tipo_check" CHECK ("tipo" IN ('COPIA','CARNET','POLAROID'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficePiezaImpresion" ADD CONSTRAINT "FotofficePiezaImpresion_cantidad_check" CHECK ("cantidad" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeHojaImpresion" ADD CONSTRAINT "FotofficeHojaImpresion_copias_check" CHECK ("copias" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_hojas_check" CHECK ("hojas" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FotofficeRegistroImpresion" ADD CONSTRAINT "FotofficeRegistroImpresion_motivo_check" CHECK ("motivo" IN ('NORMAL','DESCARTADA','PRUEBA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
