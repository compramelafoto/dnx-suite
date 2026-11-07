-- FOTOFFICE: cuenta de CLF conectada y ventas de CLF validadas contra Mercado Pago (conexión con CLF, etapa 2).
-- Sólo en la base de FOTOFFICE (rama Neon development). No toca la Caja.
CREATE TABLE "FotofficeClfConexion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clfUserId" INTEGER NOT NULL,
    "clfCuentaNombre" TEXT NOT NULL,
    "clfMpUserId" TEXT,
    "cursor" TEXT,
    "ultimaSincronizacionEl" TIMESTAMP(3),
    "ultimoError" TEXT,
    "cerradaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeClfConexion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeClfConexion_workspaceId_key" ON "FotofficeClfConexion"("workspaceId");
ALTER TABLE "FotofficeClfConexion" ADD CONSTRAINT "FotofficeClfConexion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FotofficeClfVenta" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clfOrderId" INTEGER NOT NULL,
    "mpPaymentId" TEXT,
    "albumId" INTEGER NOT NULL,
    "albumTitulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "pagadoEl" TIMESTAMP(3) NOT NULL,
    "estadoClf" TEXT NOT NULL,
    "motivo" TEXT,
    "pagoFamiliaArs" DECIMAL(14,2) NOT NULL,
    "comisionPlataformaArs" DECIMAL(14,2) NOT NULL,
    "descuentoReferidosArs" DECIMAL(14,2) NOT NULL,
    "comisionOrganizadorArs" DECIMAL(14,2) NOT NULL,
    "retenidoEsperadoArs" DECIMAL(14,2) NOT NULL,
    "netoFotografoArs" DECIMAL(14,2) NOT NULL,
    "cobrador" TEXT NOT NULL,
    "cobradorMpUserId" TEXT,
    "validacion" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "mpBrutoArs" DECIMAL(14,2),
    "mpComisionPlataformaArs" DECIMAL(14,2),
    "mpComisionMpArs" DECIMAL(14,2),
    "mpAcreditadoArs" DECIMAL(14,2),
    "mpReintegradoArs" DECIMAL(14,2),
    "reintegradoEl" TIMESTAMP(3),
    "mpRevisadoEl" TIMESTAMP(3),
    "conexionCerrada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeClfVenta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FotofficeClfVenta_workspaceId_clfOrderId_key" ON "FotofficeClfVenta"("workspaceId", "clfOrderId");
CREATE INDEX "FotofficeClfVenta_workspaceId_pagadoEl_idx" ON "FotofficeClfVenta"("workspaceId", "pagadoEl");
CREATE INDEX "FotofficeClfVenta_workspaceId_validacion_idx" ON "FotofficeClfVenta"("workspaceId", "validacion");
ALTER TABLE "FotofficeClfVenta" ADD CONSTRAINT "FotofficeClfVenta_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
