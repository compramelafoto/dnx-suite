-- Centro de reclamos de CLF (soporte, capa 1). Sólo agrega. Idempotente. Se aplica ANTES del deploy.
-- ADD VALUE va fuera de la transacción: el valor nuevo no se usa en esta migración.
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_CUSTOMER' BEFORE 'RESOLVED';

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "slaDesde" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "esperandoDesde" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "clienteRespondioAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "clienteEscribioAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "vencimientoAvisadoAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "cerradoPor" TEXT;

ALTER TABLE "SupportMessage" ADD COLUMN IF NOT EXISTS "origen" TEXT;
ALTER TABLE "SupportMessage" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SupportMessage_idempotencyKey_key" ON "SupportMessage"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "SupportDiagnosis" (
  "id" TEXT NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "estado" TEXT NOT NULL,
  "categoria" TEXT,
  "resumen" TEXT,
  "hallazgos" TEXT,
  "respuestaSugerida" TEXT,
  "acciones" JSONB NOT NULL DEFAULT '[]',
  "confianza" TEXT,
  "mailSinVerificar" BOOLEAN NOT NULL DEFAULT false,
  "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportDiagnosis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportDiagnosis_ticketId_key" ON "SupportDiagnosis"("ticketId");
DO $$ BEGIN
  ALTER TABLE "SupportDiagnosis" ADD CONSTRAINT "SupportDiagnosis_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SupportCaseToken" (
  "id" TEXT NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupportCaseToken_tokenHash_key" ON "SupportCaseToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "SupportCaseToken_ticketId_idx" ON "SupportCaseToken"("ticketId");
DO $$ BEGIN
  ALTER TABLE "SupportCaseToken" ADD CONSTRAINT "SupportCaseToken_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
