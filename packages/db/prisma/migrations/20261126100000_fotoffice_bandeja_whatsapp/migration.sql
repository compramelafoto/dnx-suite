-- FOTOFFICE · Bandeja de WhatsApp (etapa A, sin conexión real). Crea TRES tablas nuevas y no toca
-- ninguna existente (las relaciones inversas del esquema de Prisma no son columnas).
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE.

-- CreateTable
CREATE TABLE "FotofficeWaConexion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "wabaId" TEXT,
    "displayPhone" TEXT,
    "modo" TEXT NOT NULL DEFAULT 'SIMULADO',
    "pausaBotHoras" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWaConexion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeWaChat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "nombre" TEXT,
    "clientId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BOT',
    "asignadoUserId" INTEGER,
    "botPausadoHasta" TIMESTAMP(3),
    "ultimoMensajeEn" TIMESTAMP(3) NOT NULL,
    "ultimoEntranteEn" TIMESTAMP(3),
    "ultimoMensajeTexto" TEXT,
    "ultimoMensajeTipo" TEXT,
    "noLeidos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeWaChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeWaMensaje" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "autorUserId" INTEGER,
    "autorLabel" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "texto" TEXT,
    "media" JSONB,
    "waMessageId" TEXT,
    "estadoEnvio" TEXT NOT NULL DEFAULT 'RECIBIDO',
    "errorCodigo" TEXT,
    "clientToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeWaMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaConexion_workspaceId_key" ON "FotofficeWaConexion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaConexion_phoneNumberId_key" ON "FotofficeWaConexion"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaChat_workspaceId_waId_key" ON "FotofficeWaChat"("workspaceId", "waId");

-- CreateIndex
CREATE INDEX "FotofficeWaChat_workspaceId_estado_ultimoMensajeEn_idx" ON "FotofficeWaChat"("workspaceId", "estado", "ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "FotofficeWaChat_workspaceId_asignadoUserId_idx" ON "FotofficeWaChat"("workspaceId", "asignadoUserId");

-- CreateIndex
CREATE INDEX "FotofficeWaChat_clientId_idx" ON "FotofficeWaChat"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaMensaje_workspaceId_waMessageId_key" ON "FotofficeWaMensaje"("workspaceId", "waMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeWaMensaje_chatId_clientToken_key" ON "FotofficeWaMensaje"("chatId", "clientToken");

-- CreateIndex
CREATE INDEX "FotofficeWaMensaje_chatId_createdAt_idx" ON "FotofficeWaMensaje"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "FotofficeWaConexion" ADD CONSTRAINT "FotofficeWaConexion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWaChat" ADD CONSTRAINT "FotofficeWaChat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWaChat" ADD CONSTRAINT "FotofficeWaChat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWaMensaje" ADD CONSTRAINT "FotofficeWaMensaje_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeWaMensaje" ADD CONSTRAINT "FotofficeWaMensaje_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "FotofficeWaChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
