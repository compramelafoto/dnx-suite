-- Turnos de servicio, etapa 1: el cliente reserva solo un turno sin cobro desde el sitio.
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "isBookable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "publicDescription" TEXT;
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "modality" TEXT;
ALTER TABLE "FotofficeCitaTipo" ADD COLUMN IF NOT EXISTS "address" TEXT;

CREATE TABLE IF NOT EXISTS "FotofficeCitaTipoFranja" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  CONSTRAINT "FotofficeCitaTipoFranja_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FotofficeCitaTipoFranja_rango_check" CHECK ("weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
);
CREATE INDEX IF NOT EXISTS "FotofficeCitaTipoFranja_typeId_idx" ON "FotofficeCitaTipoFranja"("typeId");
CREATE INDEX IF NOT EXISTS "FotofficeCitaTipoFranja_workspaceId_idx" ON "FotofficeCitaTipoFranja"("workspaceId");

CREATE TABLE IF NOT EXISTS "FotofficeTurnosAjustes" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "pageTitle" TEXT,
  "pageIntro" TEXT,
  "cancelWindowHours" INTEGER NOT NULL DEFAULT 48,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "minAdvanceHours" INTEGER NOT NULL DEFAULT 24,
  "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
  "notifyEmail" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FotofficeTurnosAjustes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTurnosAjustes_workspaceId_key" ON "FotofficeTurnosAjustes"("workspaceId");

CREATE TABLE IF NOT EXISTS "FotofficeTurno" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "hostUserId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "answers" JSONB,
  "manageTokenHash" TEXT NOT NULL,
  "citaId" TEXT,
  "clientId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "cancelledInWindow" BOOLEAN,
  "rejectReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FotofficeTurno_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTurno_manageTokenHash_key" ON "FotofficeTurno"("manageTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeTurno_citaId_key" ON "FotofficeTurno"("citaId");
CREATE INDEX IF NOT EXISTS "FotofficeTurno_workspaceId_status_idx" ON "FotofficeTurno"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "FotofficeTurno_workspaceId_startAt_idx" ON "FotofficeTurno"("workspaceId", "startAt");
CREATE INDEX IF NOT EXISTS "FotofficeTurno_workspaceId_contactEmail_idx" ON "FotofficeTurno"("workspaceId", "contactEmail");
CREATE INDEX IF NOT EXISTS "FotofficeTurno_typeId_idx" ON "FotofficeTurno"("typeId");
CREATE INDEX IF NOT EXISTS "FotofficeTurno_clientId_idx" ON "FotofficeTurno"("clientId");

DO $$ BEGIN
  ALTER TABLE "FotofficeCitaTipoFranja" ADD CONSTRAINT "FotofficeCitaTipoFranja_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeCitaTipoFranja" ADD CONSTRAINT "FotofficeCitaTipoFranja_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "FotofficeCitaTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTurnosAjustes" ADD CONSTRAINT "FotofficeTurnosAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTurno" ADD CONSTRAINT "FotofficeTurno_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTurno" ADD CONSTRAINT "FotofficeTurno_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "FotofficeCitaTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTurno" ADD CONSTRAINT "FotofficeTurno_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "FotofficeCita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FotofficeTurno" ADD CONSTRAINT "FotofficeTurno_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
