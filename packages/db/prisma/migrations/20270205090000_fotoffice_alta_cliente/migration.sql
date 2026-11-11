-- Formulario de alta de clientes nuevos (enlace privado /alta/<token>).
-- Aditivo: una tabla nueva. Idempotente: se puede correr dos veces.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FotofficeAltaCliente" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cuestionario" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "workspaceId" TEXT,
    "respuestas" JSONB NOT NULL DEFAULT '{}',
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "enviadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAltaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeAltaCliente_token_key" ON "FotofficeAltaCliente"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FotofficeAltaCliente_workspaceId_idx" ON "FotofficeAltaCliente"("workspaceId");
