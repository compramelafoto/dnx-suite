-- Recuperación de tarjetas: un caso por tarjeta y los archivos que el programa de escritorio
-- encontró en ella. Sólo la base de FOTOFFICE. Se aplica a mano y se registra con
-- `prisma migrate resolve --applied 20270111120000_fotoffice_recuperacion_tarjetas`.
CREATE TABLE IF NOT EXISTS "FotofficeRecuperacion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "notas" TEXT,
  "codigo" TEXT NOT NULL,
  "codigoVenceAt" TIMESTAMP(3) NOT NULL,
  "tokenHash" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ESPERANDO',
  "dispositivo" TEXT,
  "equipo" TEXT,
  "versionPrograma" TEXT,
  "bytesTotales" BIGINT NOT NULL DEFAULT 0,
  "bytesLeidos" BIGINT NOT NULL DEFAULT 0,
  "encontrados" INTEGER NOT NULL DEFAULT 0,
  "sectoresMalos" BIGINT NOT NULL DEFAULT 0,
  "mensaje" TEXT,
  "vinculadoAt" TIMESTAMP(3),
  "ultimaSenalAt" TIMESTAMP(3),
  "terminadoAt" TIMESTAMP(3),
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FotofficeRecuperacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeRecuperacion_codigo_key" ON "FotofficeRecuperacion"("codigo");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeRecuperacion_tokenHash_key" ON "FotofficeRecuperacion"("tokenHash");
CREATE INDEX IF NOT EXISTS "FotofficeRecuperacion_workspaceId_createdAt_idx" ON "FotofficeRecuperacion"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "FotofficeRecuperacionArchivo" (
  "id" TEXT NOT NULL,
  "recuperacionId" TEXT NOT NULL,
  "indice" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "tamanio" BIGINT NOT NULL,
  "offset" BIGINT NOT NULL,
  "ancho" INTEGER,
  "alto" INTEGER,
  "fechaToma" TEXT,
  "camara" TEXT,
  "nombreLocal" TEXT NOT NULL,
  "miniaturaKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FotofficeRecuperacionArchivo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeRecuperacionArchivo_recuperacionId_indice_key" ON "FotofficeRecuperacionArchivo"("recuperacionId", "indice");
CREATE INDEX IF NOT EXISTS "FotofficeRecuperacionArchivo_recuperacionId_tipo_idx" ON "FotofficeRecuperacionArchivo"("recuperacionId", "tipo");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecuperacion_workspaceId_fkey') THEN
    ALTER TABLE "FotofficeRecuperacion" ADD CONSTRAINT "FotofficeRecuperacion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecuperacionArchivo_recuperacionId_fkey') THEN
    ALTER TABLE "FotofficeRecuperacionArchivo" ADD CONSTRAINT "FotofficeRecuperacionArchivo_recuperacionId_fkey" FOREIGN KEY ("recuperacionId") REFERENCES "FotofficeRecuperacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecuperacion_estado_check') THEN
    ALTER TABLE "FotofficeRecuperacion" ADD CONSTRAINT "FotofficeRecuperacion_estado_check" CHECK ("estado" IN ('ESPERANDO','ESCANEANDO','TERMINADO','ERROR'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FotofficeRecuperacionArchivo_tipo_check') THEN
    ALTER TABLE "FotofficeRecuperacionArchivo" ADD CONSTRAINT "FotofficeRecuperacionArchivo_tipo_check" CHECK ("tipo" IN ('JPEG','RAW','HEIC','VIDEO'));
  END IF;
END $$;
