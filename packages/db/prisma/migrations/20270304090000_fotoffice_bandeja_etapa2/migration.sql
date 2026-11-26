-- Bandeja de WhatsApp, etapa 2 (diseño 2026-11-24): respuestas rápidas, resumen y «Nuevo para vos».
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "resumen" TEXT;
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "resumenEn" TIMESTAMP(3);
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "derivadoSinVerUserId" INTEGER;

CREATE TABLE IF NOT EXISTS "FotofficeWaRespuestaRapida" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "atajo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeWaRespuestaRapida_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeWaRespuestaRapida_workspaceId_atajo_key" ON "FotofficeWaRespuestaRapida"("workspaceId", "atajo");
