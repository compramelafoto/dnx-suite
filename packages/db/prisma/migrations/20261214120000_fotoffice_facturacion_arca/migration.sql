-- FOTOFFICE: facturación electrónica con ARCA (Factura C y Nota de crédito C).
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes. Idempotente: se puede correr dos veces.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-09-13-negocio-caja-ventas-servicio-tecnico-y-club-design.md §11

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeFiscalProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ivaCondition" TEXT NOT NULL DEFAULT 'MONOTRIBUTO',
    "domicilioFiscal" TEXT NOT NULL,
    "ingresosBrutos" TEXT,
    "inicioActividades" TEXT,
    "defaultPointOfSale" INTEGER,
    "activeEnvironment" TEXT NOT NULL DEFAULT 'HOMOLOGACION',
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeFiscalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeArcaCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ESPERANDO_CERTIFICADO',
    "csrPem" TEXT NOT NULL,
    "keyCiphertext" TEXT NOT NULL,
    "keyNonce" TEXT NOT NULL,
    "keyAuthTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "certPem" TEXT,
    "certSerial" TEXT,
    "certExpiresAt" TIMESTAMP(3),
    "certUploadedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeArcaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeArcaTicket" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "generationTime" TIMESTAMP(3) NOT NULL,
    "expirationTime" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeArcaTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "pointOfSale" INTEGER NOT NULL,
    "cbteTipo" INTEGER NOT NULL,
    "cbteNumero" INTEGER,
    "concepto" INTEGER NOT NULL,
    "cbteFch" TEXT NOT NULL,
    "servDesde" TEXT,
    "servHasta" TEXT,
    "vtoPago" TEXT,
    "clientId" TEXT,
    "receptorDocTipo" INTEGER NOT NULL,
    "receptorDocNro" TEXT NOT NULL,
    "receptorName" TEXT NOT NULL,
    "receptorIvaCondition" TEXT NOT NULL,
    "receptorCondicionIvaId" INTEGER NOT NULL,
    "receptorDomicilio" TEXT,
    "emisorSnapshot" JSONB NOT NULL,
    "impNeto" DECIMAL(14,2) NOT NULL,
    "impIVA" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impTotConc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impOpEx" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impTrib" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impTotal" DECIMAL(14,2) NOT NULL,
    "cae" TEXT,
    "caeVto" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "arcaRequestJson" JSONB,
    "arcaResponseJson" JSONB,
    "sentAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "relatedInvoiceId" TEXT,
    "saleId" TEXT,
    "pedidoId" TEXT,
    "membershipChargeId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceArs" DECIMAL(14,2) NOT NULL,
    "ivaRate" DECIMAL(5,2),
    "lineTotalArs" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "FotofficeInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeInvoiceEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorLabel" TEXT,
    "note" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeInvoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeFiscalProfile_workspaceId_key" ON "FotofficeFiscalProfile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeArcaCredential_workspaceId_environment_key" ON "FotofficeArcaCredential"("workspaceId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeArcaTicket_workspaceId_environment_service_key" ON "FotofficeArcaTicket"("workspaceId", "environment", "service");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoice_workspaceId_status_idx" ON "FotofficeInvoice"("workspaceId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoice_workspaceId_createdAt_idx" ON "FotofficeInvoice"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoice_workspaceId_saleId_idx" ON "FotofficeInvoice"("workspaceId", "saleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoice_workspaceId_pedidoId_idx" ON "FotofficeInvoice"("workspaceId", "pedidoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoice_relatedInvoiceId_idx" ON "FotofficeInvoice"("relatedInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeInvoice_workspaceId_environment_pointOfSale_cbteTi_key" ON "FotofficeInvoice"("workspaceId", "environment", "pointOfSale", "cbteTipo", "cbteNumero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoiceItem_invoiceId_idx" ON "FotofficeInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeInvoiceEvent_invoiceId_createdAt_idx" ON "FotofficeInvoiceEvent"("invoiceId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeInvoice" ADD CONSTRAINT "FotofficeInvoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "FotofficeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeInvoiceItem" ADD CONSTRAINT "FotofficeInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FotofficeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FotofficeInvoiceEvent" ADD CONSTRAINT "FotofficeInvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FotofficeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Un solo comprobante vivo por venta: no se puede facturar dos veces la misma venta.
-- (Una factura ANULADA o RECHAZADA no cuenta: la venta se puede volver a facturar.)
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeInvoice_una_factura_viva_por_venta" ON "FotofficeInvoice"("workspaceId", "saleId")
  WHERE "saleId" IS NOT NULL AND "cbteTipo" = 11 AND "status" IN ('BORRADOR', 'PENDIENTE', 'AUTORIZADA');

-- Una sola nota de crédito viva por factura.
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeInvoice_una_nota_viva_por_factura" ON "FotofficeInvoice"("relatedInvoiceId")
  WHERE "relatedInvoiceId" IS NOT NULL AND "cbteTipo" = 13 AND "status" IN ('BORRADOR', 'PENDIENTE', 'AUTORIZADA');
