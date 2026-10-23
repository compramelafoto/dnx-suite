-- FOTOFFICE: fallas que dejaron la pantalla en blanco, mandadas por el navegador desde la
-- pantalla de error. Tabla nueva y propia de FOTOFFICE. Idempotente.
CREATE TABLE IF NOT EXISTS "FotofficeErrorPantalla" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alcance" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "nombre" TEXT,
    "digest" TEXT,
    "pila" TEXT,
    "deploymentId" TEXT,
    "userAgent" TEXT,
    "userId" INTEGER,
    "workspaceId" TEXT,
    CONSTRAINT "FotofficeErrorPantalla_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FotofficeErrorPantalla_createdAt_idx" ON "FotofficeErrorPantalla"("createdAt");
