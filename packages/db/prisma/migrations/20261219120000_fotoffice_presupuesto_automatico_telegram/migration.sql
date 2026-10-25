-- FOTOFFICE · Presupuesto automático con aprobación por Telegram.
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes. Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: queda todo apagado.
-- Diseño: apps/fotoffice/docs/superpowers/specs/2026-10-25-presupuesto-automatico-telegram-design.md

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeTelegramConexion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "chatId" TEXT,
    "chatNombre" TEXT,
    "linkCode" TEXT,
    "linkCodeExpiresAt" TIMESTAMP(3),
    "webhookSecretHash" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3),
    "connectedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeTelegramConexion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficePresupuestoAutoCategoria" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portfolio" JSONB,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePresupuestoAutoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficePresupuestoAutoAjustes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "acuseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "acuseText" TEXT,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePresupuestoAutoAjustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficePresupuestoAprobacion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "presupuestoId" TEXT,
    "categoryId" TEXT,
    "origin" TEXT NOT NULL,
    "waId" TEXT,
    "status" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "telegramMessageId" TEXT,
    "channels" JSONB,
    "errorCode" TEXT,
    "approvedVia" TEXT,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficePresupuestoAprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTelegramConexion_workspaceId_key" ON "FotofficeTelegramConexion"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePresupuestoAutoCategoria_workspaceId_categoryId_key" ON "FotofficePresupuestoAutoCategoria"("workspaceId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePresupuestoAutoAjustes_workspaceId_key" ON "FotofficePresupuestoAutoAjustes"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficePresupuestoAprobacion_workspaceId_leadId_key" ON "FotofficePresupuestoAprobacion"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficePresupuestoAprobacion_workspaceId_status_createdAt_idx" ON "FotofficePresupuestoAprobacion"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficePresupuestoAprobacion_workspaceId_waId_idx" ON "FotofficePresupuestoAprobacion"("workspaceId", "waId");
