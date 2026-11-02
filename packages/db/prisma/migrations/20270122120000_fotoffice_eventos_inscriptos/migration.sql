-- CreateTable
CREATE TABLE "FotofficeEvento" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "lugar" TEXT,
    "cupo" INTEGER,
    "formularioClaves" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeEventoEntrada" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tipo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeEventoEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeEventoInscripto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "dni" TEXT,
    "tipo" TEXT,
    "origen" TEXT NOT NULL,
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "montoArs" DECIMAL(12,2),
    "storeOrderId" TEXT,
    "storeOrderItemId" TEXT,
    "unidad" INTEGER NOT NULL DEFAULT 1,
    "formularioEnvioId" TEXT,
    "codigo" TEXT NOT NULL,
    "acreditadoAt" TIMESTAMP(3),
    "acreditadoPorUserId" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeEventoInscripto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeEvento_workspaceId_archivado_idx" ON "FotofficeEvento"("workspaceId", "archivado");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoEntrada_productId_key" ON "FotofficeEventoEntrada"("productId");

-- CreateIndex
CREATE INDEX "FotofficeEventoEntrada_workspaceId_idx" ON "FotofficeEventoEntrada"("workspaceId");

-- CreateIndex
CREATE INDEX "FotofficeEventoEntrada_eventoId_idx" ON "FotofficeEventoEntrada"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoInscripto_formularioEnvioId_key" ON "FotofficeEventoInscripto"("formularioEnvioId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoInscripto_codigo_key" ON "FotofficeEventoInscripto"("codigo");

-- CreateIndex
CREATE INDEX "FotofficeEventoInscripto_workspaceId_eventoId_idx" ON "FotofficeEventoInscripto"("workspaceId", "eventoId");

-- CreateIndex
CREATE INDEX "FotofficeEventoInscripto_eventoId_acreditadoAt_idx" ON "FotofficeEventoInscripto"("eventoId", "acreditadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeEventoInscripto_storeOrderItemId_unidad_key" ON "FotofficeEventoInscripto"("storeOrderItemId", "unidad");

-- AddForeignKey
ALTER TABLE "FotofficeEventoEntrada" ADD CONSTRAINT "FotofficeEventoEntrada_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "FotofficeEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeEventoInscripto" ADD CONSTRAINT "FotofficeEventoInscripto_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "FotofficeEvento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

