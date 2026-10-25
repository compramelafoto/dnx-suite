-- FOTOFFICE · Etapa B (15/10/2026): seña al aceptar el presupuesto.
-- Crea dos tablas nuevas: `FotofficeCobroAjustes` (pedido automático al aceptar y datos de
-- transferencia, una fila por organización) y `FotofficeEsperaPago` (transferencias esperadas, para la
-- conciliación). NO suma columnas a tablas existentes, no borra nada ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción ANTES de fusionar y se
-- registra en `_prisma_migrations`. Sin estas tablas el código lee los ajustes como "de fábrica"
-- (todo apagado) y no ofrece transferencia.

-- CreateTable
CREATE TABLE "FotofficeCobroAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "autoConfirmarPedido" BOOLEAN NOT NULL DEFAULT false,
    "alias" TEXT,
    "cbuCvu" TEXT,
    "titular" TEXT,
    "cuit" TEXT,
    "banco" TEXT,
    "montoUnico" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficeCobroAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeEsperaPago" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "importeEsperadoArs" DECIMAL(12,2) NOT NULL,
    "importeUnicoArs" DECIMAL(12,2),
    "estado" TEXT NOT NULL DEFAULT 'ESPERANDO',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conciliadaEn" TIMESTAMP(3),
    "cobroId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEsperaPago_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FotofficeEsperaPago_estado_check" CHECK ("estado" IN ('ESPERANDO', 'CONCILIADA', 'ANULADA')),
    CONSTRAINT "FotofficeEsperaPago_importe_check" CHECK ("importeEsperadoArs" > 0),
    CONSTRAINT "FotofficeEsperaPago_unico_check" CHECK (
        "importeUnicoArs" IS NULL
        OR ("importeUnicoArs" > "importeEsperadoArs" AND "importeUnicoArs" <= "importeEsperadoArs" + 99)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeCobroAjustes_workspaceId_key" ON "FotofficeCobroAjustes"("workspaceId");
CREATE INDEX "FotofficeEsperaPago_workspaceId_estado_idx" ON "FotofficeEsperaPago"("workspaceId", "estado");
CREATE INDEX "FotofficeEsperaPago_pedidoId_idx" ON "FotofficeEsperaPago"("pedidoId");
CREATE INDEX "FotofficeEsperaPago_cuotaId_idx" ON "FotofficeEsperaPago"("cuotaId");
-- Una sola espera abierta por cuota.
CREATE UNIQUE INDEX "FotofficeEsperaPago_cuota_abierta_key" ON "FotofficeEsperaPago"("cuotaId") WHERE "estado" = 'ESPERANDO';
-- Un monto único no se repite entre las esperas abiertas de la organización.
CREATE UNIQUE INDEX "FotofficeEsperaPago_monto_unico_key" ON "FotofficeEsperaPago"("workspaceId", "importeUnicoArs")
    WHERE "estado" = 'ESPERANDO' AND "importeUnicoArs" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "FotofficeCobroAjustes" ADD CONSTRAINT "FotofficeCobroAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeEsperaPago" ADD CONSTRAINT "FotofficeEsperaPago_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeEsperaPago" ADD CONSTRAINT "FotofficeEsperaPago_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "FotofficePedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeEsperaPago" ADD CONSTRAINT "FotofficeEsperaPago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "FotofficePedidoCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
