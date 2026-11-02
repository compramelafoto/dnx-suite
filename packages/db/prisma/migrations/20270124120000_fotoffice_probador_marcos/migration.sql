-- Probador de cuadros, etapa 4: modelos de marco reales con su foto de frente.
CREATE TABLE IF NOT EXISTS "FotofficeModeloMarco" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "imagenUrl" TEXT NOT NULL,
  "imagenAncho" INTEGER NOT NULL,
  "imagenAlto" INTEGER NOT NULL,
  "ventanaX" DOUBLE PRECISION NOT NULL,
  "ventanaY" DOUBLE PRECISION NOT NULL,
  "ventanaW" DOUBLE PRECISION NOT NULL,
  "ventanaH" DOUBLE PRECISION NOT NULL,
  "exteriorAnchoCm" DOUBLE PRECISION NOT NULL,
  "exteriorAltoCm" DOUBLE PRECISION NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FotofficeModeloMarco_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeModeloMarco_workspaceId_productId_color_key" ON "FotofficeModeloMarco"("workspaceId", "productId", "color");
CREATE INDEX IF NOT EXISTS "FotofficeModeloMarco_workspaceId_activo_idx" ON "FotofficeModeloMarco"("workspaceId", "activo");
