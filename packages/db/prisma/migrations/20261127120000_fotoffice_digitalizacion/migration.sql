-- FOTOFFICE: digitalización de VHS y DVD (parte 1, la grabadora). Sólo tablas nuevas. Idempotente.
CREATE TABLE IF NOT EXISTS "DigitalizacionEquipo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "huellaSinSenal" JSONB,
    "corregirProporcion" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DigitalizacionEquipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionEquipo_workspaceId_etiqueta_key" ON "DigitalizacionEquipo"("workspaceId", "etiqueta");

CREATE TABLE IF NOT EXISTS "DigitalizacionGrabacion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT,
    "cassetteNumero" INTEGER,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'GRABANDO',
    "motivoFin" TEXT,
    "mimeType" TEXT NOT NULL,
    "calidad" TEXT,
    "corregirProporcion" BOOLEAN NOT NULL DEFAULT false,
    "equipoId" TEXT,
    "tramos" INTEGER NOT NULL DEFAULT 1,
    "duracionSeg" INTEGER NOT NULL DEFAULT 0,
    "bytesSubidos" BIGINT NOT NULL DEFAULT 0,
    "partesListas" INTEGER NOT NULL DEFAULT 0,
    "primeraImagenSeg" INTEGER,
    "ultimaImagenSeg" INTEGER,
    "ultimaImagenTramo" INTEGER,
    "sinImagen" BOOLEAN NOT NULL DEFAULT false,
    "tramosSinSenal" JSONB,
    "dvdArchivos" JSONB,
    "ultimoLatidoAt" TIMESTAMP(3),
    "iniciadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DigitalizacionGrabacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_workspaceId_createdAt_idx" ON "DigitalizacionGrabacion"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_proyectoId_idx" ON "DigitalizacionGrabacion"("proyectoId");
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_equipoId_idx" ON "DigitalizacionGrabacion"("equipoId");

CREATE TABLE IF NOT EXISTS "DigitalizacionParte" (
    "id" TEXT NOT NULL,
    "grabacionId" TEXT NOT NULL,
    "tramo" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigitalizacionParte_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionParte_key_key" ON "DigitalizacionParte"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionParte_grabacionId_tramo_indice_key" ON "DigitalizacionParte"("grabacionId", "tramo", "indice");

CREATE TABLE IF NOT EXISTS "DigitalizacionAjustes" (
    "workspaceId" TEXT NOT NULL,
    "minutosSinSenal" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "DigitalizacionAjustes_pkey" PRIMARY KEY ("workspaceId")
);

DO $$ BEGIN
  ALTER TABLE "DigitalizacionEquipo" ADD CONSTRAINT "DigitalizacionEquipo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "DigitalizacionEquipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionParte" ADD CONSTRAINT "DigitalizacionParte_grabacionId_fkey" FOREIGN KEY ("grabacionId") REFERENCES "DigitalizacionGrabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionAjustes" ADD CONSTRAINT "DigitalizacionAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
