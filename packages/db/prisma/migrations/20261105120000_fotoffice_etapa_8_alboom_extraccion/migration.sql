-- Etapa 8A FOTOFFICE: conectar Alboom y extraer. Crea `FotofficeAlboomCrudo` (la respuesta cruda de Alboom, un
-- registro por entidad e identificador, con huella sha256) y `FotofficeAlboomExtraccion` (cada extracción con su
-- avance por entidad), con índices, claves foráneas en cascada y CHECK. Un índice único parcial impide dos
-- extracciones activas (PENDIENTE o CORRIENDO) en el mismo workspace.
-- Sólo crea tablas nuevas: no toca ninguna existente, no borra ni actualiza filas.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en producción, antes de fusionar, y se registra con
-- `migrate resolve` (ver `packages/db/docs/MIGRACION-ETAPA-8A.md`).
-- Lo que el SQL no puede chequear lo valida el código (`lib/alboom`): la forma de `progress`, que `entity` sea una
-- clave del catálogo y que nada de esto llegue al navegador salvo contadores.

-- CreateTable
CREATE TABLE "FotofficeAlboomCrudo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "alboomId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotofficeAlboomCrudo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotofficeAlboomExtraccion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "mode" TEXT NOT NULL DEFAULT 'TODO',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "startedByUserId" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FotofficeAlboomExtraccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FotofficeAlboomCrudo_workspaceId_entity_idx" ON "FotofficeAlboomCrudo"("workspaceId", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "FotofficeAlboomCrudo_workspaceId_entity_alboomId_key" ON "FotofficeAlboomCrudo"("workspaceId", "entity", "alboomId");

-- CreateIndex
CREATE INDEX "FotofficeAlboomExtraccion_workspaceId_startedAt_idx" ON "FotofficeAlboomExtraccion"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "FotofficeAlboomExtraccion_status_updatedAt_idx" ON "FotofficeAlboomExtraccion"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "FotofficeAlboomCrudo" ADD CONSTRAINT "FotofficeAlboomCrudo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotofficeAlboomExtraccion" ADD CONSTRAINT "FotofficeAlboomExtraccion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A lo sumo una extracción activa por workspace (índice único parcial; Prisma no lo modela).
CREATE UNIQUE INDEX "FotofficeAlboomExtraccion_workspaceId_activa_key" ON "FotofficeAlboomExtraccion"("workspaceId") WHERE "status" IN ('PENDIENTE', 'CORRIENDO');

-- CHECK
ALTER TABLE "FotofficeAlboomCrudo" ADD CONSTRAINT "FotofficeAlboomCrudo_entity" CHECK (char_length("entity") BETWEEN 1 AND 60);
ALTER TABLE "FotofficeAlboomCrudo" ADD CONSTRAINT "FotofficeAlboomCrudo_alboomId" CHECK (char_length("alboomId") BETWEEN 1 AND 300);
ALTER TABLE "FotofficeAlboomCrudo" ADD CONSTRAINT "FotofficeAlboomCrudo_hash" CHECK ("hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "FotofficeAlboomExtraccion" ADD CONSTRAINT "FotofficeAlboomExtraccion_status" CHECK ("status" IN ('PENDIENTE', 'CORRIENDO', 'LISTA', 'ERROR', 'CANCELADA'));
ALTER TABLE "FotofficeAlboomExtraccion" ADD CONSTRAINT "FotofficeAlboomExtraccion_mode" CHECK ("mode" IN ('TODO', 'INCREMENTAL'));
ALTER TABLE "FotofficeAlboomExtraccion" ADD CONSTRAINT "FotofficeAlboomExtraccion_errorReason" CHECK ("errorReason" IS NULL OR char_length("errorReason") <= 500);
ALTER TABLE "FotofficeAlboomExtraccion" ADD CONSTRAINT "FotofficeAlboomExtraccion_finishedAt" CHECK (("status" IN ('PENDIENTE', 'CORRIENDO') AND "finishedAt" IS NULL) OR ("status" IN ('LISTA', 'ERROR', 'CANCELADA') AND "finishedAt" IS NOT NULL));
