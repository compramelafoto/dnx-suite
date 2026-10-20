-- Etapa 7 FOTOFFICE, Entrega A1: galería de selección.
-- Crea siete tablas nuevas (`FotofficeGaleria`, `FotofficeGaleriaFoto`, `FotofficeGaleriaCliente`,
-- `FotofficeGaleriaSeleccion`, `FotofficeGaleriaComentario`, `FotofficeGaleriaEvento` y `FotofficeGaleriaAjustes`)
-- y reemplaza el CHECK de `FotofficeMessageTemplate.entityType` por la misma lista de la Etapa 5 más 'GALERIA'.
-- NO suma columnas a ninguna tabla existente: las FKs nacen en las tablas nuevas. No borra nada ni actualiza filas.
-- La numeración (`GALERIA`) no tiene CHECK de clave en la base: la crea el código la primera vez que se necesita.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se
-- registra con `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A1.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/galerias`): que el proyecto, el contacto y la
-- portada sean del mismo workspace (y la portada, de la propia galería), y los topes por galería.

-- CreateTable
CREATE TABLE "FotofficeGaleria" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT,
    "saleMode" TEXT NOT NULL DEFAULT 'SELECCION',
    "kind" TEXT NOT NULL DEFAULT 'SELECCION',
    "selectionMode" TEXT NOT NULL DEFAULT 'LIBRE',
    "minSelect" INTEGER,
    "maxSelect" INTEGER,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "downloadMode" TEXT NOT NULL DEFAULT 'VISTA',
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "coverFotoId" TEXT,
    "orderMode" TEXT NOT NULL DEFAULT 'NOMBRE',
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "ownerUserId" INTEGER,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaFoto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "viewKey" TEXT,
    "thumbKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "errorReason" TEXT,
    "sizeBytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleriaFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaCliente" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenIssuedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'EN_PROGRESO',
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submitMessage" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleriaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaSeleccion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaClienteId" TEXT NOT NULL,
    "fotoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeGaleriaSeleccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaComentario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaClienteId" TEXT NOT NULL,
    "fotoId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorUserId" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeGaleriaComentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaEvento" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "galeriaId" TEXT NOT NULL,
    "galeriaClienteId" TEXT,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeGaleriaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeGaleriaAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultMessage" TEXT,
    "defaultSelectionMode" TEXT NOT NULL DEFAULT 'LIBRE',
    "defaultAllowComments" BOOLEAN NOT NULL DEFAULT true,
    "defaultDownloadMode" TEXT NOT NULL DEFAULT 'VISTA',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeGaleriaAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleria_coverFotoId_key" ON "FotofficeGaleria"("coverFotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleria_workspaceId_status_idx" ON "FotofficeGaleria"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FotofficeGaleria_proyectoId_idx" ON "FotofficeGaleria"("proyectoId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleria_workspaceId_number_key" ON "FotofficeGaleria"("workspaceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaFoto_originalKey_key" ON "FotofficeGaleriaFoto"("originalKey");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaFoto_galeriaId_status_idx" ON "FotofficeGaleriaFoto"("galeriaId", "status");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaFoto_galeriaId_order_idx" ON "FotofficeGaleriaFoto"("galeriaId", "order");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaFoto_workspaceId_idx" ON "FotofficeGaleriaFoto"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaCliente_tokenHash_key" ON "FotofficeGaleriaCliente"("tokenHash");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCliente_galeriaId_status_idx" ON "FotofficeGaleriaCliente"("galeriaId", "status");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCliente_clientId_idx" ON "FotofficeGaleriaCliente"("clientId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaCliente_workspaceId_idx" ON "FotofficeGaleriaCliente"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaSeleccion_fotoId_idx" ON "FotofficeGaleriaSeleccion"("fotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaSeleccion_workspaceId_idx" ON "FotofficeGaleriaSeleccion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaSeleccion_galeriaClienteId_fotoId_key" ON "FotofficeGaleriaSeleccion"("galeriaClienteId", "fotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaComentario_galeriaClienteId_fotoId_idx" ON "FotofficeGaleriaComentario"("galeriaClienteId", "fotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaComentario_fotoId_idx" ON "FotofficeGaleriaComentario"("fotoId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaComentario_workspaceId_idx" ON "FotofficeGaleriaComentario"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaEvento_galeriaId_createdAt_idx" ON "FotofficeGaleriaEvento"("galeriaId", "createdAt");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaEvento_galeriaClienteId_idx" ON "FotofficeGaleriaEvento"("galeriaClienteId");

-- CreateIndex
CREATE INDEX "FotofficeGaleriaEvento_workspaceId_idx" ON "FotofficeGaleriaEvento"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeGaleriaAjustes_workspaceId_key" ON "FotofficeGaleriaAjustes"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_coverFotoId_fkey" FOREIGN KEY ("coverFotoId") REFERENCES "FotofficeGaleriaFoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaSeleccion" ADD CONSTRAINT "FotofficeGaleriaSeleccion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaSeleccion" ADD CONSTRAINT "FotofficeGaleriaSeleccion_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaSeleccion" ADD CONSTRAINT "FotofficeGaleriaSeleccion_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "FotofficeGaleriaFoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "FotofficeGaleriaFoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaEvento" ADD CONSTRAINT "FotofficeGaleriaEvento_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaEvento" ADD CONSTRAINT "FotofficeGaleriaEvento_galeriaId_fkey" FOREIGN KEY ("galeriaId") REFERENCES "FotofficeGaleria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaEvento" ADD CONSTRAINT "FotofficeGaleriaEvento_galeriaClienteId_fkey" FOREIGN KEY ("galeriaClienteId") REFERENCES "FotofficeGaleriaCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeGaleriaAjustes" ADD CONSTRAINT "FotofficeGaleriaAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un contacto aparece una sola vez por galería (los clientes sin contacto no se limitan).
CREATE UNIQUE INDEX "FotofficeGaleriaCliente_galeriaId_clientId_key" ON "FotofficeGaleriaCliente"("galeriaId", "clientId") WHERE "clientId" IS NOT NULL;

-- CHECK
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_saleMode" CHECK ("saleMode" IN ('SELECCION', 'SELECCION_Y_VENTA', 'VENTA'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_selectionMode" CHECK ("selectionMode" IN ('LIBRE', 'CANTIDAD'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_minMax" CHECK (
  ("selectionMode" = 'LIBRE' AND "minSelect" IS NULL AND "maxSelect" IS NULL)
  OR ("selectionMode" = 'CANTIDAD'
      AND ("minSelect" IS NOT NULL OR "maxSelect" IS NOT NULL)
      AND ("minSelect" IS NULL OR "minSelect" >= 1)
      AND ("maxSelect" IS NULL OR "maxSelect" >= 1)
      AND ("minSelect" IS NULL OR "maxSelect" IS NULL OR "minSelect" <= "maxSelect"))
);
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_downloadMode" CHECK ("downloadMode" IN ('NINGUNA', 'VISTA', 'SELECCIONADAS'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_status" CHECK ("status" IN ('BORRADOR', 'PUBLICADA', 'ARCHIVADA'));
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_orderMode" CHECK ("orderMode" IN ('NOMBRE', 'MANUAL'));
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_status" CHECK ("status" IN ('PENDIENTE', 'LISTA', 'ERROR'));
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_attempts" CHECK ("attempts" >= 0);
ALTER TABLE "FotofficeGaleriaFoto" ADD CONSTRAINT "FotofficeGaleriaFoto_sizeBytes" CHECK ("sizeBytes" IS NULL OR "sizeBytes" > 0);
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_status" CHECK ("status" IN ('EN_PROGRESO', 'EN_REVISION', 'FINALIZADO'));
ALTER TABLE "FotofficeGaleriaCliente" ADD CONSTRAINT "FotofficeGaleriaCliente_tokenHash" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_author" CHECK ("author" IN ('CLIENTE', 'ESTUDIO'));
ALTER TABLE "FotofficeGaleriaComentario" ADD CONSTRAINT "FotofficeGaleriaComentario_body" CHECK (length(trim("body")) > 0 AND length("body") <= 2000);
ALTER TABLE "FotofficeGaleriaAjustes" ADD CONSTRAINT "FotofficeGaleriaAjustes_defaultSelectionMode" CHECK ("defaultSelectionMode" IN ('LIBRE', 'CANTIDAD'));
ALTER TABLE "FotofficeGaleriaAjustes" ADD CONSTRAINT "FotofficeGaleriaAjustes_defaultDownloadMode" CHECK ("defaultDownloadMode" IN ('NINGUNA', 'VISTA', 'SELECCIONADAS'));
ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";
ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA', 'CONTRATO', 'GALERIA'));
