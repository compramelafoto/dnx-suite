-- Conexión FOTOFFICE ↔ CLF, etapa 1: vínculo de un pedido (o de un proyecto sin pedido) con su álbum de CLF.
CREATE TABLE "FotofficeClfVinculo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "proyectoId" TEXT,
    "clfAlbumId" INTEGER NOT NULL,
    "albumSlug" TEXT NOT NULL,
    "tituloSnapshot" TEXT NOT NULL,
    "tienePreventa" BOOLEAN NOT NULL,
    "preventaCierraEl" TIMESTAMP(3),
    "creadoPorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeClfVinculo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FotofficeClfVinculo_un_destino_check" CHECK (("pedidoId" IS NULL) <> ("proyectoId" IS NULL))
);

CREATE UNIQUE INDEX "FotofficeClfVinculo_pedidoId_key" ON "FotofficeClfVinculo"("pedidoId");
CREATE UNIQUE INDEX "FotofficeClfVinculo_proyectoId_key" ON "FotofficeClfVinculo"("proyectoId");
CREATE INDEX "FotofficeClfVinculo_workspaceId_idx" ON "FotofficeClfVinculo"("workspaceId");

ALTER TABLE "FotofficeClfVinculo" ADD CONSTRAINT "FotofficeClfVinculo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeClfVinculo" ADD CONSTRAINT "FotofficeClfVinculo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeClfVinculo" ADD CONSTRAINT "FotofficeClfVinculo_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
