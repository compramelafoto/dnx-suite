-- Etapa 8B-1 FOTOFFICE: traducir y cargar desde Alboom (datos base). Crea `FotofficeAlboomMapa` (qué registro de
-- FOTOFFICE corresponde a cada registro de Alboom, con la huella de lo último cargado) y `FotofficeAlboomCarga`
-- (cada simulación o carga con su informe y su avance), con índices, claves foráneas en cascada y CHECK. Un índice
-- único parcial impide dos simulaciones/cargas activas (PENDIENTE o CORRIENDO) en el mismo workspace.
-- Sólo crea tablas nuevas: no toca ninguna existente, no borra ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se registra con
-- `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-8B1.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/alboom/carga`): la forma de `report`/`progress`, que
-- `entity` sea una entidad conocida, que `targetId` exista en la tabla de su `targetType`, y que el informe no
-- lleve datos personales.

-- CreateTable
CREATE TABLE "FotofficeAlboomMapa" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "alboomId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "fieldHashes" JSONB NOT NULL DEFAULT '{}',
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAlboomMapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeAlboomCarga" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "entities" JSONB NOT NULL DEFAULT '[]',
    "report" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "fingerprint" TEXT,
    "startedByUserId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAlboomCarga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeAlboomMapa_workspaceId_targetType_targetId_idx" ON "FotofficeAlboomMapa"("workspaceId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeAlboomMapa_workspaceId_entity_alboomId_key" ON "FotofficeAlboomMapa"("workspaceId", "entity", "alboomId");

-- CreateIndex
CREATE INDEX "FotofficeAlboomCarga_workspaceId_startedAt_idx" ON "FotofficeAlboomCarga"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "FotofficeAlboomCarga_status_updatedAt_idx" ON "FotofficeAlboomCarga"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A lo sumo una simulación o carga activa por workspace (índice único parcial; Prisma no lo modela).
CREATE UNIQUE INDEX "FotofficeAlboomCarga_workspaceId_activa_key" ON "FotofficeAlboomCarga"("workspaceId") WHERE "status" IN ('PENDIENTE', 'CORRIENDO');

-- CHECK
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_entity" CHECK (char_length("entity") BETWEEN 1 AND 60);
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_alboomId" CHECK (char_length("alboomId") BETWEEN 1 AND 300);
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_targetType" CHECK (char_length("targetType") BETWEEN 1 AND 40);
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_targetId" CHECK (char_length("targetId") BETWEEN 1 AND 100);
ALTER TABLE "FotofficeAlboomMapa" ADD CONSTRAINT "FotofficeAlboomMapa_payloadHash" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_mode" CHECK ("mode" IN ('SIMULACION', 'CARGA'));
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_status" CHECK ("status" IN ('PENDIENTE', 'CORRIENDO', 'LISTA', 'ERROR', 'CANCELADA'));
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_fingerprint" CHECK ("fingerprint" IS NULL OR "fingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_errorReason" CHECK ("errorReason" IS NULL OR char_length("errorReason") <= 500);
ALTER TABLE "FotofficeAlboomCarga" ADD CONSTRAINT "FotofficeAlboomCarga_finishedAt" CHECK (("status" IN ('PENDIENTE', 'CORRIENDO') AND "finishedAt" IS NULL) OR ("status" IN ('LISTA', 'ERROR', 'CANCELADA') AND "finishedAt" IS NOT NULL));
