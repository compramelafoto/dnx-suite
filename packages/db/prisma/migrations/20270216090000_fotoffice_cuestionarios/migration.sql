-- FOTOFFICE · Cuestionarios para clientes (lo que el estudio antes mandaba por Google Forms).
-- Sólo tablas nuevas, sin claves foráneas a tablas existentes.
-- Idempotente: se puede correr dos veces.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano, con el flujo de migraciones de FOTOFFICE
-- (y después `prisma migrate resolve --applied`). El código tolera que falten: sin las tablas, la ficha
-- del cliente no muestra cuestionarios y el enlace público responde «no disponible».

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeCuestionario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "intro" TEXT,
    "definicion" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeCuestionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeCuestionarioEnvio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cuestionarioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "respuestas" JSONB,
    "enviadoPorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEn" TIMESTAMP(3),

    CONSTRAINT "FotofficeCuestionarioEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeCuestionario_workspaceId_clave_key" ON "FotofficeCuestionario"("workspaceId", "clave");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeCuestionario_workspaceId_activo_orden_idx" ON "FotofficeCuestionario"("workspaceId", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeCuestionarioEnvio_token_key" ON "FotofficeCuestionarioEnvio"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeCuestionarioEnvio_workspaceId_clientId_createdAt_idx" ON "FotofficeCuestionarioEnvio"("workspaceId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeCuestionarioEnvio_workspaceId_cuestionarioId_idx" ON "FotofficeCuestionarioEnvio"("workspaceId", "cuestionarioId");

COMMIT;
